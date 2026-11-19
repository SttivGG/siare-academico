import hashlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
import zlib
from unittest.mock import patch

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, DictionaryObject, DecodedStreamObject, ArrayObject
from app.models.extraction import ExtractionError, extract
from app.models.extraction_model import ExtractionModel
from fixture_factory import pdf_bytes


def box(kind, data):
    return (len(data) + 8).to_bytes(4, "big") + kind + data


def manifest():
    suffix = bytes.fromhex("00110010800000aa00389b71")
    desc = lambda kind, name: box(b"jumd", kind + suffix + b"\x03" + name + b"\0")
    return box(b"jumb", desc(b"c2pa", b"c2pa") + box(b"jumb", desc(b"c2ma", b"urn:c2pa:synthetic") + box(b"cbor", b"\xa0")))


def pdf_with(data=None, change=None, compressed=False):
    writer = PdfWriter(clone_from=io.BytesIO(pdf_bytes()))
    if data is not None:
        stream = DecodedStreamObject(); stream.set_data(data)
        stream[NameObject("/Type")] = NameObject("/EmbeddedFile")
        stream[NameObject("/Subtype")] = NameObject("/application/c2pa")
        if compressed:
            stream = stream.flate_encode()
        reference = writer._add_object(stream)
        spec = DictionaryObject({NameObject("/Type"): NameObject("/Filespec"),
                                 NameObject("/AFRelationship"): NameObject("/C2PA_Manifest"),
                                 NameObject("/EF"): DictionaryObject({NameObject("/F"): reference})})
        writer._root_object[NameObject("/AF")] = ArrayObject([writer._add_object(spec)])
    if change:
        change(writer)
    output = io.BytesIO(); writer.write(output)
    return output.getvalue()


class PdfPolicyTests(unittest.TestCase):
    def parse(self, data, worker=False):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "source.pdf")
            with open(path, "wb") as output:
                output.write(data)
            return ExtractionModel().extract(path, "PDF") if worker else extract(path, "PDF")

    def test_structural_c2pa_unverified_and_text_equivalence(self):
        expected = self.parse(pdf_bytes())
        for compressed in (False, True):
            result = self.parse(pdf_with(manifest(), compressed=compressed), worker=True)
            self.assertEqual(result["result"]["text"], expected["text"])
            self.assertEqual(result["result"]["fragments"], expected["fragments"])
            self.assertEqual(result["result"]["warnings"], ["PROVENANCE_UNVERIFIED", "ASSOCIATED_FILES_IGNORED"])

    def test_labels_extensions_and_mime_cannot_bless_executables_or_unknown_data(self):
        for data in (b"MZ" + bytes(256), b"\x7fELF" + bytes(256), b"#!/bin/sh\nexit 0", b"unknown", manifest() + b"MZ"):
            self.assertEqual(self.parse(pdf_with(data), worker=True)["errorCode"], "ATTACHMENTS_NOT_ALLOWED")

    def test_nonexecuting_associated_data_is_classified_by_content_and_ignored(self):
        from pypdf.generic import TextStringObject
        def data_relation(writer):
            spec = writer._root_object["/AF"][0].get_object()
            spec[NameObject("/AFRelationship")] = NameObject("/Data")
            spec[NameObject("/F")] = TextStringObject("misleading.exe")
        for data in (b'{"notes":"not study text"}', b'<notes><source>not study text</source></notes>'):
            result = self.parse(pdf_with(data, data_relation), worker=True)["result"]
            self.assertEqual(result["warnings"], ["ASSOCIATED_FILES_IGNORED"])
            self.assertNotIn("not study text", result["text"])
        for data in (b'<svg xmlns="http://www.w3.org/2000/svg"/>', b'<notes href="file:///etc/passwd"/>', b'<!DOCTYPE a [<!ENTITY e SYSTEM "file:///etc/passwd">]><a>&e;</a>'):
            self.assertEqual(self.parse(pdf_with(data, data_relation), worker=True)["errorCode"], "ATTACHMENTS_NOT_ALLOWED")

    def test_active_content_wins_over_provenance_and_unknown_attachments(self):
        for key in ("/JS", "/JavaScript", "/OpenAction", "/AA", "/XFA", "/RichMedia", "/Launch"):
            result = self.parse(pdf_with(manifest(), lambda writer: writer._root_object.__setitem__(NameObject(key), NameObject("/blocked"))), worker=True)
            self.assertEqual(result["errorCode"], "ACTIVE_CONTENT")
        for action in ("/JavaScript", "/Launch", "/SubmitForm", "/GoToR", "/GoToE", "/ImportData", "/Rendition"):
            def change(writer):
                # Unreachable objects must also be inspected.
                writer._add_object(DictionaryObject({NameObject("/S"): NameObject(action)}))
            self.assertEqual(self.parse(pdf_with(manifest(), change), worker=True)["errorCode"], "ACTIVE_CONTENT")

    def test_associated_and_page_expansion_limits(self):
        self.assertEqual(self.parse(pdf_with(bytes(256 * 1024 + 1), compressed=True), worker=True)["errorCode"], "DOCUMENT_LIMIT_EXCEEDED")
        def change(writer):
            stream = DecodedStreamObject(); stream.set_data(b" " * (8 * 1024 * 1024 + 1))
            writer.pages[0][NameObject("/Contents")] = writer._add_object(stream.flate_encode())
        result = self.parse(pdf_with(change=change), worker=True)
        self.assertIn(result["errorCode"], ("DOCUMENT_LIMIT_EXCEEDED", "UNSAFE_DOCUMENT"))

    def test_unsafe_uri_and_external_streams(self):
        for uri in ("javascript:alert(1)", "file:///etc/passwd", "data:text/html,hello", "//evil.test"):
            from pypdf.generic import TextStringObject
            def change(writer):
                writer._root_object[NameObject("/Other")] = DictionaryObject({NameObject("/S"): NameObject("/URI"), NameObject("/URI"): TextStringObject(uri)})
            self.assertEqual(self.parse(pdf_with(change=change), worker=True)["errorCode"], "ACTIVE_CONTENT")
        def external(writer):
            from pypdf.generic import TextStringObject
            writer.pages[0]["/Contents"].get_object()[NameObject("/F")] = TextStringObject("file:///etc/passwd")
        self.assertEqual(self.parse(pdf_with(change=external), worker=True)["errorCode"], "ACTIVE_CONTENT")

    def test_original_c2pa_sha256_and_equivalent_without_associations(self):
        path = os.environ.get("SIARE_TEST_PDF")
        if not path:
            self.skipTest("Set SIARE_TEST_PDF to a read-only mounted original")
        with open(path, "rb") as source:
            data = source.read()
        checksum = hashlib.sha256(data).hexdigest()
        self.assertEqual(checksum, "66cdd9f6cd895d4837cd68aa1208d89ca4bf4b9760e2c24e54cbf9e76815735e")
        result = self.parse(data, worker=True)["result"]
        self.assertEqual(result["unitCount"], 13)
        self.assertGreater(len(result["text"]), 10_000)
        self.assertIn("aggregate", result["text"].lower())
        writer = PdfWriter()
        for page in PdfReader(io.BytesIO(data)).pages:
            writer.add_page(page)
        output = io.BytesIO(); writer.write(output)
        equivalent = self.parse(output.getvalue(), worker=True)["result"]
        self.assertEqual(equivalent["text"], result["text"])
        self.assertEqual(equivalent["fragments"], result["fragments"])
        self.assertEqual(equivalent["warnings"], [])
        with open(path, "rb") as source:
            self.assertEqual(hashlib.sha256(source.read()).hexdigest(), checksum)


class SandboxTests(unittest.TestCase):
    def test_os_denies_network_parent_state_and_writes_outside_job(self):
        script = '''
import errno, os, socket, sys
from app.models.parser_sandbox import restrict
directory = sys.argv[1]
restrict("/etc/ld.so.cache", directory)
checks = [lambda: socket.socket(), lambda: open("/proc/self/environ", "rb"), lambda: open("/tmp/forbidden", "w")]
for check in checks:
    try:
        check()
    except OSError as error:
        assert error.errno in (errno.EACCES, errno.EPERM, errno.EROFS)
        continue
    raise AssertionError("sandbox permitted forbidden access")
with open(directory + "/allowed", "w") as output:
    output.write("ok")
print("sandbox enforced")
'''
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([sys.executable, "-c", script, directory], capture_output=True, timeout=10,
                                    env={"PATH": "/usr/local/bin:/usr/bin:/bin", "PYTHONDONTWRITEBYTECODE": "1"})
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        self.assertIn(b"sandbox enforced", result.stdout)

    def test_worker_does_not_inherit_service_secrets(self):
        with patch.dict(os.environ, {"CONTENT_SERVICE_TOKEN": "synthetic-secret", "MONGO_PASSWORD": "synthetic-secret"}):
            with patch("app.models.extraction_model.subprocess.Popen") as launch:
                launch.return_value.wait.return_value = 0
                launch.return_value.returncode = 1
                ExtractionModel().extract("unused", "PDF")
                environment = launch.call_args.kwargs["env"]
                self.assertNotIn("CONTENT_SERVICE_TOKEN", environment)
                self.assertNotIn("MONGO_PASSWORD", environment)
                self.assertTrue(launch.call_args.kwargs["close_fds"])
