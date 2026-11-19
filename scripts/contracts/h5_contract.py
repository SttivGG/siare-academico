"""Offline H5 contract oracle for synthetic fixtures, not a production adapter."""

import argparse
import json
import math
import re
import unicodedata
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / 'docs' / 'contracts' / 'h5'
SCHEMA = json.loads((CONTRACTS / 'activity-draft.schema.json').read_text(encoding='utf-8'))
REQUEST_MAX_BYTES = 512 * 1024
RESPONSE_MAX_BYTES = 2 * 1024 * 1024
REFERENCE_PREFIX = {'page': 'Página', 'slide': 'Diapositiva', 'section': 'Sección', 'image': 'Imagen'}


class ContractViolation(ValueError):
    """Expose only a stable rule code; never echo private values."""


def require(condition, code):
    if not condition:
        raise ContractViolation(code)


def strict_json(raw, maximum):
    require(len(raw) <= maximum, 'PAYLOAD_TOO_LARGE')

    def pairs(values):
        result = {}
        for key, value in values:
            require(key not in result, 'DUPLICATE_JSON_KEY')
            result[key] = value
        return result

    def reject_constant(_value):
        raise ContractViolation('NON_FINITE_JSON')

    def finite_float(value):
        parsed = float(value)
        require(math.isfinite(parsed), 'NON_FINITE_JSON')
        return parsed

    try:
        value = json.loads(raw.decode('utf-8'), object_pairs_hook=pairs,
                           parse_constant=reject_constant, parse_float=finite_float)
    except ContractViolation:
        raise
    except (UnicodeError, ValueError, RecursionError) as error:
        raise ContractViolation('INVALID_JSON') from error
    pending = [(value, 1)]
    while pending:
        current, depth = pending.pop()
        require(depth <= 16, 'JSON_DEPTH_LIMIT')
        if isinstance(current, dict):
            pending.extend((item, depth + 1) for item in current.values())
        elif isinstance(current, list):
            pending.extend((item, depth + 1) for item in current)
    return value


def utf16_length(value):
    try:
        return len(value.encode('utf-16-le')) // 2
    except UnicodeError as error:
        raise ContractViolation('INVALID_UNICODE') from error


def utf16_limits(value, schema):
    """Apply H3 Java bounds in addition to JSON Schema's code-point bounds."""
    if '$ref' in schema:
        schema = SCHEMA['$defs'][schema['$ref'].rsplit('/', 1)[-1]]
    if isinstance(value, str):
        size = utf16_length(value)
        require(size <= schema.get('maxLength', size), 'UTF16_LENGTH')
    elif isinstance(value, dict):
        for key, item in value.items():
            utf16_limits(item, schema.get('properties', {}).get(key, {}))
    elif isinstance(value, list):
        for item in value:
            utf16_limits(item, schema.get('items', {}))


def validate_shape(value, definition):
    selected = {'$schema': SCHEMA['$schema'], '$defs': SCHEMA['$defs'], '$ref': '#/$defs/' + definition}
    validator = Draft202012Validator(selected, format_checker=FormatChecker())
    error = next(validator.iter_errors(value), None)
    if error is not None:
        raise ContractViolation('SCHEMA_' + definition)
    utf16_limits(value, selected)


def normalize(value):
    upper = unicodedata.normalize('NFC', value.strip()).upper().replace('Ñ', '\ue000')
    decomposed = unicodedata.normalize('NFD', upper)
    plain = ''.join(c for c in decomposed if not unicodedata.category(c).startswith('M'))
    # Java's default regex \s is ASCII; keep this oracle aligned with ActivityRules.
    return re.sub(r'[ \t\n\x0b\f\r-]', '', plain.replace('\ue000', 'Ñ'))


def unique(values, code):
    require(len(values) == len(set(values)), code)


def validate_request(request):
    validate_shape(request, 'DraftRequest')
    indexes = [f['index'] for f in request['fragments']]
    unique(indexes, 'DUPLICATE_FRAGMENT')
    require(indexes == sorted(indexes), 'FRAGMENT_ORDER')
    require(sum(utf16_length(f['text']) for f in request['fragments']) <= 100000, 'TEXT_LIMIT')
    require(request['topic'] == request['topic'].strip(), 'TOPIC_WHITESPACE')
    for fragment in request['fragments']:
        expected = f"{REFERENCE_PREFIX[fragment['unitType']]} {fragment['unitNumber']}"
        require(fragment['reference'] == expected, 'FRAGMENT_REFERENCE')


def validate_response(request, response):
    validate_request(request)
    validate_shape(response, 'DraftResponse')
    for key in ['schemaVersion', 'requestId', 'documentId', 'extractionVersion', 'type', 'topic', 'count']:
        require(response[key] == request[key], 'ECHO_' + key)
    require(set(request['extractionWarnings']).issubset(response['warnings']), 'WARNING_LOST')
    quiz = request['type'] == 'QUIZ'
    entries = response['draft']['questions' if quiz else 'words']
    require(len(entries) == request['count'], 'COUNT_MISMATCH')
    unique([item['id'] for item in entries], 'DUPLICATE_ITEM')
    fragments = {f['index']: f for f in request['fragments']}
    if quiz:
        unique([normalize(item['prompt']) for item in entries], 'DUPLICATE_PROMPT')
    else:
        unique([normalize(item['answer']) for item in entries], 'DUPLICATE_WORD')
    for item in entries:
        require(item['topic'] == request['topic'], 'ITEM_TOPIC')
        if quiz:
            options = item['options']
            unique([o['id'] for o in options], 'DUPLICATE_OPTION_ID')
            unique([o['text'].strip().lower() for o in options], 'DUPLICATE_OPTION_TEXT')
            selected = [o['text'] for o in options if o['id'] == item['correctOptionId']]
            require(len(selected) == 1, 'INVALID_ANSWER_KEY')
            answer = selected[0]
        else:
            answer = normalize(item['answer'])
            require(re.fullmatch(r'[A-ZÑ]{2,25}', answer) is not None, 'INVALID_WORD')
        source = item['source']
        fragment = fragments.get(source['fragmentIndex'])
        require(fragment is not None, 'UNSELECTED_FRAGMENT')
        for field in ['reference', 'unitType', 'unitNumber']:
            require(source[field] == fragment[field], 'SOURCE_REFERENCE')
        require(source['quote'] in fragment['text'], 'QUOTE_NOT_LITERAL')
        normalized_answer = normalize(answer)
        require(bool(normalized_answer), 'EMPTY_NORMALIZED_ANSWER')
        require(normalized_answer in normalize(source['quote']), 'ANSWER_NOT_IN_QUOTE')


def validate_error(request, response):
    validate_request(request)
    validate_shape(response, 'ErrorResponse')
    # A valid request with credentials and correlation must retain requestId.
    require(response['requestId'] == request['requestId'], 'ERROR_CORRELATION')
    if response['code'] == 'INSUFFICIENT_CONTENT' and 'availableCount' in response['details']:
        require(response['details']['availableCount'] < request['count'], 'INVALID_AVAILABLE_COUNT')
    if response['code'] == 'CONTENT_QUALITY_FAILED':
        reasons = response['details'].get('reasonCodes', [])
        require(bool(set(reasons) & {'OCR_UNREADABLE', 'AMBIGUOUS_QUESTION',
                                    'UNSUPPORTED_EXPLANATION', 'DUPLICATE_CONTENT'}), 'QUALITY_REASON_REQUIRED')


def validate_exchange(request_raw, response_raw, request_id, status=200, retry_after=None):
    request = strict_json(request_raw, REQUEST_MAX_BYTES)
    response = strict_json(response_raw, RESPONSE_MAX_BYTES)
    validate_request(request)
    require(request_id == request['requestId'], 'HEADER_CORRELATION')
    if status == 200:
        validate_response(request, response)
    else:
        validate_error(request, response)
        require(response['status'] == status, 'ERROR_HTTP_STATUS')
        if status in [429, 503]:
            require(isinstance(retry_after, str) and re.fullmatch(r'[0-9]{1,2}', retry_after) is not None
                    and 1 <= int(retry_after) <= 60, 'RETRY_AFTER_REQUIRED')
    return response


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--request', required=True, type=Path)
    parser.add_argument('--response', required=True, type=Path)
    parser.add_argument('--request-id', required=True)
    parser.add_argument('--status', type=int, default=200)
    parser.add_argument('--retry-after')
    args = parser.parse_args()
    try:
        validate_exchange(args.request.read_bytes(), args.response.read_bytes(), args.request_id,
                          args.status, args.retry_after)
    except ContractViolation as error:
        parser.exit(1, f'FAIL: {error}\n')
    print('PASS: H5 proposed contract; semantic quality and real HTTP not certified.')


if __name__ == '__main__':
    main()
