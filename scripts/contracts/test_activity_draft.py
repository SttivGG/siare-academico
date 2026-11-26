"""Consumer/provider conformance examples; no live services or private documents."""

import copy
import json
import unittest

from jsonschema import Draft202012Validator, FormatChecker

from h5_contract import (
    CONTRACTS, ROOT, SCHEMA, ContractViolation, REQUEST_MAX_BYTES, RESPONSE_MAX_BYTES,
    normalize, strict_json, validate_error, validate_exchange, validate_request,
    validate_response, validate_shape,
)


def fixture(name):
    return json.loads((CONTRACTS / 'fixtures' / (name + '.json')).read_text(encoding='utf-8'))


def encode(value):
    return json.dumps(value, ensure_ascii=False).encode('utf-8')


class ActivityDraftContractTests(unittest.TestCase):
    def setUp(self):
        self.request = fixture('quiz-request')
        self.response = fixture('quiz-response')

    def rejects(self, code, operation, *args):
        with self.assertRaisesRegex(ContractViolation, '^' + code + '$'):
            operation(*args)

    def test_schema_and_all_definitions_are_valid_2020_12(self):
        Draft202012Validator.check_schema(SCHEMA)
        for definition in SCHEMA['$defs'].values():
            Draft202012Validator.check_schema(definition)

    def test_both_families_pass_full_exchange(self):
        for family in ['quiz', 'crossword']:
            with self.subTest(family=family):
                request = fixture(family + '-request')
                result = validate_exchange(encode(request), encode(fixture(family + '-response')), request['requestId'])
                self.assertIs(result['draft']['validated'], False)

    def test_explanations_and_review_are_required_for_both_families(self):
        for family, collection in [('quiz', 'questions'), ('crossword', 'words')]:
            for field in ['explanation', 'source']:
                with self.subTest(family=family, field=field):
                    response = fixture(family + '-response')
                    del response['draft'][collection][0][field]
                    self.rejects('SCHEMA_DraftResponse', validate_response, fixture(family + '-request'), response)
        for target, field in [('draft', 'validated'), ('quality', 'requiresHumanReview')]:
            response = copy.deepcopy(self.response)
            response[target][field] = not response[target][field]
            self.rejects('SCHEMA_DraftResponse', validate_response, self.request, response)

    def test_unknown_or_authoritative_fields_rejected(self):
        for field in ['studentId', 'ownerId', 'score', 'bank', 'modelUrl']:
            with self.subTest(field=field):
                request = copy.deepcopy(self.request)
                request[field] = 'untrusted'
                self.rejects('SCHEMA_DraftRequest', validate_request, request)
        self.response['draft']['questions'][0]['source']['html'] = '<script>bad()</script>'
        self.rejects('SCHEMA_DraftResponse', validate_response, self.request, self.response)

    def test_request_boundaries_and_types(self):
        cases = [('schemaVersion', 2), ('schemaVersion', True), ('count', 0), ('count', 51),
                 ('count', '1'), ('gridSize', 4), ('gridSize', 26), ('topic', ''),
                 ('topic', ' '), ('topic', 'x' * 101), ('language', 'en'),
                 ('requestId', 'not-a-uuid'), ('extractionVersion', 'checksum-only')]
        for field, value in cases:
            with self.subTest(field=field, value=value):
                request = copy.deepcopy(self.request)
                request[field] = value
                self.rejects('SCHEMA_DraftRequest', validate_request, request)
        for count in [1, 13]:
            request = fixture('crossword-request')
            request['count'] = count
            self.rejects('SCHEMA_DraftRequest', validate_request, request)

    def test_fragment_limits_order_and_canonical_reference(self):
        for fragments in [[], self.request['fragments'] * 33]:
            request = copy.deepcopy(self.request)
            request['fragments'] = fragments
            self.rejects('SCHEMA_DraftRequest', validate_request, request)
        self.request['fragments'] *= 2
        self.rejects('DUPLICATE_FRAGMENT', validate_request, self.request)
        self.request['fragments'][1] = {**self.request['fragments'][1], 'index': 1, 'unitNumber': 2, 'reference': 'Página 2'}
        self.request['fragments'].reverse()
        self.rejects('FRAGMENT_ORDER', validate_request, self.request)
        self.request['fragments'].reverse()
        self.request['fragments'][0]['reference'] = 'Página inventada'
        self.rejects('FRAGMENT_REFERENCE', validate_request, self.request)

    def test_total_text_and_utf16_limits(self):
        self.request['fragments'][0]['text'] = 'a' * 100000
        validate_request(self.request)
        self.request['fragments'].append({**self.request['fragments'][0], 'index': 1, 'text': 'b'})
        self.rejects('TEXT_LIMIT', validate_request, self.request)
        request = fixture('quiz-request')
        request['topic'] = '\U0001f600' * 51
        self.rejects('UTF16_LENGTH', validate_request, request)
        request['topic'] = 'T'
        request['fragments'][0]['text'] = '\ud800'
        self.rejects('INVALID_UNICODE', validate_request, request)

    def test_each_echo_must_match(self):
        replacements = {'requestId': '00000000-0000-4000-8000-000000000099',
                        'documentId': '00000000-0000-4000-8000-000000000099',
                        'extractionVersion': 'operation:00000000-0000-4000-8000-000000000099',
                        'topic': 'Otro tema', 'count': 2}
        for field, value in replacements.items():
            with self.subTest(field=field):
                response = copy.deepcopy(self.response)
                response[field] = value
                self.rejects('ECHO_' + field, validate_response, self.request, response)

    def test_count_and_family_are_not_partial_success(self):
        self.request['count'] = 2
        self.response['count'] = 2
        self.rejects('COUNT_MISMATCH', validate_response, self.request, self.response)
        self.response['draft']['words'] = fixture('crossword-response')['draft']['words']
        self.rejects('SCHEMA_DraftResponse', validate_response, self.request, self.response)

    def test_duplicate_ids_prompts_and_options_rejected(self):
        for kind in ['id', 'prompt']:
            request = copy.deepcopy(self.request)
            response = copy.deepcopy(self.response)
            request['count'] = response['count'] = 2
            duplicate = copy.deepcopy(response['draft']['questions'][0])
            if kind == 'id':
                duplicate['prompt'] = 'Otra pregunta.'
            else:
                duplicate['id'] = 'q2'
            response['draft']['questions'].append(duplicate)
            self.rejects('DUPLICATE_ITEM' if kind == 'id' else 'DUPLICATE_PROMPT', validate_response, request, response)
        for field, value, code in [('id', 'a', 'DUPLICATE_OPTION_ID'), ('text', 'SOL', 'DUPLICATE_OPTION_TEXT')]:
            response = copy.deepcopy(self.response)
            response['draft']['questions'][0]['options'][1][field] = value
            self.rejects(code, validate_response, self.request, response)

    def test_key_must_exist_and_answer_must_be_in_literal_quote(self):
        question = self.response['draft']['questions'][0]
        question['correctOptionId'] = 'missing'
        self.rejects('INVALID_ANSWER_KEY', validate_response, self.request, self.response)
        question['correctOptionId'] = 'b'
        self.rejects('ANSWER_NOT_IN_QUOTE', validate_response, self.request, self.response)
        question['correctOptionId'] = 'a'
        question['options'][0]['text'] = '-'
        self.rejects('EMPTY_NORMALIZED_ANSWER', validate_response, self.request, self.response)
        question['options'][0]['text'] = 'Sol'
        question['source']['quote'] = 'El Sol es verde.'
        self.rejects('QUOTE_NOT_LITERAL', validate_response, self.request, self.response)

    def test_source_must_refer_to_selected_fragment_and_unit(self):
        source = self.response['draft']['questions'][0]['source']
        source['fragmentIndex'] = 1
        self.rejects('UNSELECTED_FRAGMENT', validate_response, self.request, self.response)
        source['fragmentIndex'] = 0
        for field, value in [('reference', 'Página 9'), ('unitNumber', 9), ('unitType', 'slide')]:
            original = source[field]
            source[field] = value
            self.rejects('SOURCE_REFERENCE', validate_response, self.request, self.response)
            source[field] = original

    def test_topic_and_extraction_warnings_preserved(self):
        self.response['draft']['questions'][0]['topic'] = 'Tema ajeno'
        self.rejects('ITEM_TOPIC', validate_response, self.request, self.response)
        self.response = fixture('quiz-response')
        self.response['warnings'] = []
        self.rejects('WARNING_LOST', validate_response, self.request, self.response)

    def test_quality_flags_are_not_optional(self):
        for field in self.response['quality']['checks']:
            with self.subTest(field=field):
                response = copy.deepcopy(self.response)
                response['quality']['checks'][field] = False
                self.rejects('SCHEMA_DraftResponse', validate_response, self.request, response)

    def test_crossword_normalization_preserves_enye(self):
        for original, expected in [('cañón', 'CAÑON'), ('niño', 'NIÑO'), ('año', 'AÑO'), ('sol-luna', 'SOLLUNA')]:
            self.assertEqual(expected, normalize(original))
        self.assertNotEqual(normalize('ano'), normalize('año'))
        request, response = fixture('crossword-request'), fixture('crossword-response')
        request['fragments'][0]['text'] += ' El niño tiene un cañón.'
        word = response['draft']['words'][0]
        word['answer'] = 'cañón'
        word['source']['quote'] = 'El niño tiene un cañón.'
        validate_response(request, response)
        word['answer'] = 'canon'
        self.rejects('ANSWER_NOT_IN_QUOTE', validate_response, request, response)

    def test_crossword_duplicate_or_invalid_words_rejected(self):
        for answer, code in [('Sól', 'DUPLICATE_WORD'), ('A', 'INVALID_WORD'), ('SOL2', 'INVALID_WORD'),
                             ('X' * 26, 'INVALID_WORD')]:
            request, response = fixture('crossword-request'), fixture('crossword-response')
            response['draft']['words'][1]['answer'] = answer
            self.rejects(code, validate_response, request, response)

    def test_insufficiency_ocr_and_ambiguity_errors(self):
        for name in ['insufficient-response', 'ocr-response', 'ambiguous-response']:
            with self.subTest(name=name):
                error = fixture(name)
                validate_exchange(encode(self.request), encode(error), self.request['requestId'], 422)
                self.assertNotIn('draft', error)
        error = fixture('insufficient-response')
        error['details']['availableCount'] = 1
        self.rejects('INVALID_AVAILABLE_COUNT', validate_error, self.request, error)
        error = fixture('ocr-response')
        error['details']['reasonCodes'] = []
        self.rejects('QUALITY_REASON_REQUIRED', validate_error, self.request, error)

    def test_error_http_correlation_and_status_mapping(self):
        for status, code in [(400, 'INVALID_DRAFT_REQUEST'), (401, 'UNAUTHORIZED'), (403, 'FORBIDDEN'),
                             (413, 'PAYLOAD_TOO_LARGE'), (429, 'GENERATOR_BUSY'), (500, 'GENERATOR_ERROR'),
                             (503, 'GENERATOR_UNAVAILABLE'), (504, 'GENERATION_TIMEOUT')]:
            error = {'schemaVersion': 1, 'requestId': self.request['requestId'], 'status': status,
                     'code': code, 'message': 'Fallo seguro.', 'details': {}}
            validate_exchange(encode(self.request), encode(error), self.request['requestId'], status, '5')
            if status in [429, 503]:
                for retry in [None, '0', '61', 'unlimited']:
                    self.rejects('RETRY_AFTER_REQUIRED', validate_exchange, encode(self.request), encode(error),
                                 self.request['requestId'], status, retry)
        error = fixture('ocr-response')
        error['code'] = 'UNAUTHORIZED'
        self.rejects('SCHEMA_ErrorResponse', validate_error, self.request, error)
        error = fixture('ocr-response')
        self.rejects('ERROR_HTTP_STATUS', validate_exchange, encode(self.request), encode(error), self.request['requestId'], 504)
        error['requestId'] = None
        self.rejects('ERROR_CORRELATION', validate_error, self.request, error)
        self.rejects('HEADER_CORRELATION', validate_exchange, encode(self.request), encode(self.response), 'untrusted')

    def test_raw_json_limits_duplicates_and_nonfinite(self):
        for raw, code in [(b'{"count":1,"count":2}', 'DUPLICATE_JSON_KEY'),
                          (b'{"count":NaN}', 'NON_FINITE_JSON'), (b'{"count":Infinity}', 'NON_FINITE_JSON'),
                          (b'{"count":1e999}', 'NON_FINITE_JSON'),
                          (b'{broken', 'INVALID_JSON'), (b'\xff', 'INVALID_JSON')]:
            self.rejects(code, strict_json, raw, REQUEST_MAX_BYTES)
        self.rejects('PAYLOAD_TOO_LARGE', strict_json, b' ' * (REQUEST_MAX_BYTES + 1), REQUEST_MAX_BYTES)
        self.rejects('PAYLOAD_TOO_LARGE', strict_json, b' ' * (RESPONSE_MAX_BYTES + 1), RESPONSE_MAX_BYTES)
        self.rejects('PAYLOAD_TOO_LARGE', strict_json, ('"' + 'ñ' * REQUEST_MAX_BYTES + '"').encode(), REQUEST_MAX_BYTES)
        self.rejects('JSON_DEPTH_LIMIT', strict_json, b'[' * 17 + b'0' + b']' * 17, REQUEST_MAX_BYTES)

    def test_public_request_does_not_accept_free_text_or_identity(self):
        public = fixture('public-request')
        validate_shape(public, 'PublicDraftRequest')
        for field in ['fragments', 'ownerId', 'validated', 'quality']:
            with self.subTest(field=field):
                changed = {**public, field: 'untrusted'}
                self.rejects('SCHEMA_PublicDraftRequest', validate_shape, changed, 'PublicDraftRequest')

    def test_public_view_is_private_and_quality_is_scoped_to_generated_revision(self):
        view = fixture('public-response')
        validate_shape(view, 'PublicDraftView')
        self.assertEqual(1, view['qualityAppliesToRevision'])
        self.assertIs(view['draft']['validated'], False)
        view['draftRevision'] = 2
        validate_shape(view, 'PublicDraftView')
        view['qualityAppliesToRevision'] = 2
        self.rejects('SCHEMA_PublicDraftView', validate_shape, view, 'PublicDraftView')

    def test_revision_and_explicit_review_are_required(self):
        publish = fixture('publish-request')
        validate_shape(publish, 'PublishDraftRequest')
        for field in ['draftRevision', 'reviewConfirmed', 'idempotencyKey']:
            changed = copy.deepcopy(publish)
            del changed[field]
            self.rejects('SCHEMA_PublishDraftRequest', validate_shape, changed, 'PublishDraftRequest')
        for field, value in [('reviewConfirmed', False), ('draftRevision', 0), ('bank', self.response['draft'])]:
            changed = {**publish, field: value}
            self.rejects('SCHEMA_PublishDraftRequest', validate_shape, changed, 'PublishDraftRequest')
        validate_shape({'draftRevision': 1, 'draft': self.response['draft']}, 'ReviseDraftRequest')

    def test_reviewed_examples_fit_h3_but_raw_draft_cannot_be_an_activity_bank(self):
        production = json.loads((ROOT / 'docs' / 'openapi.json').read_text(encoding='utf-8'))
        selected = {'$schema': SCHEMA['$schema'], 'components': production['components'],
                    '$ref': '#/components/schemas/ActivityCreate'}
        validator = Draft202012Validator(selected, format_checker=FormatChecker())
        for family in ['quiz', 'crossword']:
            with self.subTest(family=family):
                reviewed = fixture('reviewed-' + family + '-h3-request')
                validator.validate(reviewed)
                reviewed['bank'] = fixture(family + '-response')['draft']
                self.assertFalse(validator.is_valid(reviewed))

    def test_openapi_examples_and_schema_refs_resolve_offline(self):
        api = json.loads((CONTRACTS / 'openapi.proposed.json').read_text(encoding='utf-8'))
        self.assertEqual('PROPOSED_PENDING_ML_AGREEMENT', api['x-siare-status'])

        def visit(value):
            if isinstance(value, dict):
                if '$ref' in value:
                    prefix, definition = value['$ref'].split('#/$defs/')
                    self.assertEqual('./activity-draft.schema.json', prefix)
                    self.assertIn(definition, SCHEMA['$defs'])
                if 'externalValue' in value:
                    self.assertTrue((CONTRACTS / value['externalValue']).is_file())
                for item in value.values():
                    visit(item)
            elif isinstance(value, list):
                for item in value:
                    visit(item)
        visit(api)
        production = json.loads((ROOT / 'docs' / 'openapi.json').read_text(encoding='utf-8'))
        self.assertFalse(any('activity-drafts' in path or 'activity-bank-drafts' in path for path in production['paths']))


if __name__ == '__main__':
    unittest.main()
