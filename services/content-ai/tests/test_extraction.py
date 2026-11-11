import io
import os
import tempfile
import unittest
import uuid
import zipfile
from unittest.mock import patch

from app import create_app
from app.models.health import HealthModel
from app.models.extraction import extract, ExtractionError
from app.models.extraction_model import ExtractionModel
from fixture_factory import fixtures


class ExtractionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.files = fixtures()

    def parse(self, name, kind):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, name)
            with open(path, "wb") as file:
                file.write(self.files[name])
            return extract(path, kind)

    def test_pdf_docx_and_pptx_real_text_and_source_units(self):
        for name, kind, unit in (("academic.pdf", "PDF", "page"), ("academic.docx", "DOCX", "section"), ("academic.pptx", "PPTX", "slide")):
            with self.subTest(kind=kind):
                result = self.parse(name, kind)
                self.assertIn("ciencias", result["text"].lower())
                self.assertEqual(result["fragments"][0]["unitType"], unit)
                self.assertEqual(result["unitCount"], 1)
                self.assertEqual(result["extractionStatus"], "READY")

    def test_scanned_pdf_and_password_have_explicit_errors(self):
        for name, code in (("scanned.pdf", "NO_EXTRACTABLE_TEXT"), ("protected.pdf", "PASSWORD_PROTECTED")):
            with self.assertRaises(ExtractionError) as error:
                self.parse(name, "PDF")
            self.assertEqual(error.exception.code, code)

    def test_image_ocr_spanish_and_empty_result(self):
        for name, kind in (("academic.png", "PNG"), ("academic.jpg", "JPEG")):
            with patch("app.models.extraction.pytesseract.image_to_string", return_value="Ciencias") as ocr:
                self.assertEqual(self.parse(name, kind)["text"], "Ciencias")
                self.assertEqual(ocr.call_args.kwargs["lang"], "spa")
                self.assertEqual(ocr.call_args.kwargs["timeout"], 12)
        with patch("app.models.extraction.pytesseract.image_to_string", return_value=""):
            with self.assertRaises(ExtractionError) as error:
                self.parse("academic.png", "PNG")
            self.assertEqual(error.exception.code, "NO_EXTRACTABLE_TEXT")

    def test_real_ocr_in_container(self):
        if os.environ.get("SIARE_REAL_OCR") != "1":
            self.skipTest("Real Tesseract Spanish OCR runs in Docker, not the host unit suite")
        for name, kind in (("academic.png", "PNG"), ("academic.jpg", "JPEG"), ("academic.jpeg", "JPEG")):
            self.assertIn("ciencias", self.parse(name, kind)["text"].lower())

    def test_zip_bomb_traversal_active_and_malformed_packages(self):
        for name, data in (("word/bomb.xml", b"a" * 1_000_000), ("../escape.xml", b"x"), ("word/vbaProject.bin", b"x"), ("word/document.xml", b"<broken")):
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as package:
                package.writestr(name, data); package.writestr("a", "a"); package.writestr("b", "b")
            self.files["unsafe.docx"] = buffer.getvalue()
            with self.assertRaises(ExtractionError):
                self.parse("unsafe.docx", "DOCX")

    def test_corrupt_and_wrong_actual_type(self):
        self.files["corrupt.pdf"] = b"%PDF-invalid"
        for name, kind in (("corrupt.pdf", "PDF"), ("academic.jpg", "PNG"), ("academic.pdf", "DOCX")):
            with self.assertRaises(ExtractionError) as error:
                self.parse(name, kind)
            self.assertEqual(error.exception.code, "CORRUPT_DOCUMENT")

    def test_killable_worker_runs_real_parser(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "sample.docx")
            with open(path, "wb") as source:
                source.write(self.files["academic.docx"])
            self.assertIn("energia", ExtractionModel().extract(path, "DOCX")["result"]["text"])

    def test_busy_and_timeout_are_bounded(self):
        model = ExtractionModel(); model.slot.acquire()
        self.assertEqual(model.extract("unused", "PDF")["errorCode"], "PROCESSOR_BUSY")
        model.slot.release()
        with patch("app.models.extraction_model.subprocess.Popen") as process:
            import subprocess
            process.return_value.wait.side_effect = [subprocess.TimeoutExpired("parser", 25), 0]
            with patch("app.models.extraction_model.os.killpg", create=True):
                self.assertEqual(model.extract("unused", "PDF")["errorCode"], "EXTRACTION_TIMEOUT")


class InternalApiTests(unittest.TestCase):
    def setUp(self):
        app = create_app(HealthModel({}))
        app.config.update(CONTENT_SERVICE_TOKEN="a" * 64, MAX_CONTENT_LENGTH=1024)
        self.client = app.test_client()
        self.headers = {"Authorization": "Bearer " + "a" * 64, "X-Operation-Id": str(uuid.uuid4()), "X-Document-Type": "PDF", "Content-Type": "application/pdf"}

    def test_internal_auth_operation_type_empty_and_size_limits(self):
        endpoint = "/internal/v1/extractions"
        self.assertEqual(self.client.post(endpoint, data=b"test").status_code, 401)
        for changes, body, status in (({"X-Operation-Id": "bad"}, b"x", 400), ({"X-Document-Type": "DOC"}, b"x", 415), ({}, b"", 400), ({}, b"x" * 1025, 413)):
            self.assertEqual(self.client.post(endpoint, headers={**self.headers, **changes}, data=body).status_code, status)

    def test_response_keeps_operation_and_hides_parser_details(self):
        with patch("app.models.extraction_model.ExtractionModel.extract", return_value={"errorCode": "CORRUPT_DOCUMENT"}):
            response = self.client.post("/internal/v1/extractions", headers=self.headers, data=b"invalid")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json["operationId"], self.headers["X-Operation-Id"])
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_internal_route_runs_real_pdf_parser(self):
        from fixture_factory import pdf_bytes
        response = self.client.post("/internal/v1/extractions", headers=self.headers, data=pdf_bytes())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["operationId"], self.headers["X-Operation-Id"])
        self.assertIn("ciencias", response.json["result"]["text"])
        self.assertEqual(response.json["result"]["fragments"][0]["unitNumber"], 1)
