"""Structural policy only: C2PA signatures/trust are deliberately NOT verified.

Associated data is inspected in bounded memory for classification, never written
out, executed, recursively opened as a file, or handed to text/OCR renderers.
Unknown associations remain in private storage and prevent READY/download.
"""
import zlib
import io
import json
from urllib.parse import urlsplit

from defusedxml import ElementTree
from PIL import Image
from pypdf.generic import DictionaryObject, StreamObject, IndirectObject

MAX_ASSOCIATED = 256 * 1024
UUID_SUFFIX = bytes.fromhex("00110010800000aa00389b71")


def is_manifest(data: bytes) -> bool:
    budget = 4096

    def boxes(start, end, depth=0):
        nonlocal budget
        if depth > 16:
            raise ValueError()
        result = []
        while start < end:
            budget -= 1
            if budget < 0 or end - start < 8:
                raise ValueError()
            size = int.from_bytes(data[start:start + 4], "big")
            kind = data[start + 4:start + 8]
            if size < 8 or size > end - start:
                raise ValueError()
            children = boxes(start + 8, start + size, depth + 1) if kind == b"jumb" else []
            result.append((kind, data[start + 8:start + size] if kind == b"jumd" else b"", children))
            start += size
        return result

    def description(box, kinds):
        children = box[2]
        if not children or children[0][0] != b"jumd":
            return False
        desc = children[0][1]
        return len(desc) >= 18 and desc[:4] in kinds and desc[4:16] == UUID_SUFFIX and bool(desc[16] & 2)

    try:
        root = boxes(0, len(data))
        if len(root) != 1 or root[0][0] != b"jumb" or not description(root[0], (b"c2pa",)):
            return False
        if root[0][2][0][1][17:].split(b"\0", 1)[0] != b"c2pa":
            return False
        return any(child[0] == b"jumb" and description(child, (b"c2ma", b"c2cm", b"c2um")) for child in root[0][2][1:])
    except ValueError:
        return False


def inspect_pdf(pdf, error):
    seen = set()
    dictionaries = []

    def inspect(node, depth=0):
        if depth > 100 or len(seen) > 200_000:
            raise error("DOCUMENT_LIMIT_EXCEEDED")
        if id(node) in seen:
            return
        seen.add(id(node))
        if isinstance(node, IndirectObject):
            inspect(node.get_object(), depth + 1)
        elif isinstance(node, dict):
            dictionaries.append(node)
            if set(node) & {"/JS", "/JavaScript", "/OpenAction", "/AA", "/Launch", "/RichMedia", "/RichMediaContent",
                            "/RichMediaSettings", "/XFA", "/Collection", "/OPI", "/Ref"}:
                raise error("ACTIVE_CONTENT")
            if node.get("/S") in {"/JavaScript", "/Launch", "/SubmitForm", "/ImportData", "/GoToR", "/GoToE",
                                   "/Rendition", "/Movie", "/Sound", "/Thread", "/Hide", "/ResetForm", "/SetOCGState"}:
                raise error("ACTIVE_CONTENT")
            if node.get("/Type") == "/Action" and node.get("/S") not in {"/GoTo", "/URI", "/Named"}:
                raise error("ACTIVE_CONTENT")
            if node.get("/Subtype") in {"/RichMedia", "/Movie", "/Sound", "/Screen", "/3D"}:
                raise error("ACTIVE_CONTENT")
            if "/URI" in node:
                uri = str(node["/URI"])
                if urlsplit(uri).scheme.lower() not in {"https", "http", "mailto"} or any(ord(c) < 32 for c in uri):
                    raise error("ACTIVE_CONTENT")
            if isinstance(node, StreamObject) and set(node) & {"/F", "/FFilter", "/FDecodeParms"}:
                raise error("ACTIVE_CONTENT")
            if node.get("/FS") == "/URL":
                raise error("ACTIVE_CONTENT")
            for value in node.values():
                inspect(value, depth + 1)
        elif isinstance(node, (list, tuple)):
            for value in node:
                inspect(value, depth + 1)

    inspect(pdf.trailer)
    # Scan every current xref object, including unreachable actions and object streams.
    references = {(generation, number) for generation, entries in pdf.xref.items() for number in entries if number}
    references.update((0, number) for number in pdf.xref_objStm)
    if len(references) > 100_000:
        raise error("DOCUMENT_LIMIT_EXCEEDED")
    for generation, number in references:
        inspect(pdf.get_object(IndirectObject(number, generation, pdf)))

    specs = [d for d in dictionaries if d.get("/Type") == "/Filespec" or "/EF" in d]
    streams = [d for d in dictionaries if d.get("/Type") == "/EmbeddedFile"]
    associated = any(set(d) & {"/EmbeddedFiles", "/AF", "/EF"} or d.get("/Subtype") == "/FileAttachment" for d in dictionaries)
    if not (specs or streams or associated):
        return []
    if not 1 <= len(specs) <= 8 or len(streams) != len(specs):
        raise error("ATTACHMENTS_NOT_ALLOWED")
    linked = set()
    total = 0
    provenance = False
    for spec in specs:
        ef = spec.get("/EF")
        if isinstance(ef, IndirectObject):
            ef = ef.get_object()
        if not isinstance(ef, DictionaryObject) or set(ef) - {"/F", "/UF"} or "/F" not in ef:
            raise error("ATTACHMENTS_NOT_ALLOWED")
        stream = ef["/F"]
        if (not isinstance(stream, StreamObject) or stream not in streams or id(stream) in linked
                or any(ef[key] is not stream for key in ef)):
            raise error("ATTACHMENTS_NOT_ALLOWED")
        linked.add(id(stream))
        # Do not use get_data(): its generic filter pipeline can allocate without this bound.
        data = stream._data
        if len(data) > MAX_ASSOCIATED:
            raise error("DOCUMENT_LIMIT_EXCEEDED")
        compression = stream.get("/Filter")
        if compression in ("/FlateDecode", ["/FlateDecode"]):
            decoder = zlib.decompressobj()
            data = decoder.decompress(data, MAX_ASSOCIATED + 1)
            if len(data) > MAX_ASSOCIATED or not decoder.eof or decoder.unused_data:
                raise error("DOCUMENT_LIMIT_EXCEEDED")
        elif compression is not None:
            raise error("ATTACHMENTS_NOT_ALLOWED")
        total += len(data)
        if total > MAX_ASSOCIATED:
            raise error("DOCUMENT_LIMIT_EXCEEDED")
        manifest = is_manifest(data)
        if spec.get("/AFRelationship") == "/C2PA_Manifest" and not manifest:
            raise error("ATTACHMENTS_NOT_ALLOWED")
        if not manifest and not is_inert_data(data):
            raise error("ATTACHMENTS_NOT_ALLOWED")
        provenance |= manifest
    return (["PROVENANCE_UNVERIFIED"] if provenance else []) + ["ASSOCIATED_FILES_IGNORED"]


def is_inert_data(data):
    # Deliberately narrow content-based formats; no HTML, SVG, scripts, archives or nested documents.
    try:
        if data.startswith((b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff")):
            with Image.open(io.BytesIO(data)) as image:
                if image.format not in ("PNG", "JPEG") or image.width * image.height > 4_000_000:
                    return False
                image.verify()
            return True
        if data.lstrip().startswith((b"{", b"[")):
            json.loads(data.decode("utf-8"))
            return True
        if data.lstrip().startswith(b"<"):
            root = ElementTree.fromstring(data, forbid_dtd=True, forbid_entities=True, forbid_external=True)
            # SVG/XHTML and processing instructions can reference active/external resources.
            if b"<?" in data.replace(b'<?xml ', b'xml ', 1) or b"<!" in data:
                return False
            for node in root.iter():
                if not isinstance(node.tag, str) or node.tag.rsplit("}", 1)[-1].lower() in {"svg", "html", "script"}:
                    return False
                if any(key.rsplit("}", 1)[-1].lower().startswith(("on", "href", "src")) for key in node.attrib):
                    return False
            return True
    except Exception:
        return False
    return False
