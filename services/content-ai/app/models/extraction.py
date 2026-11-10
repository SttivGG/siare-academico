"""Parsers run in a killable subprocess, never execute or fetch document content."""
import re
import warnings
import zipfile
from pathlib import PurePosixPath

from defusedxml import ElementTree
from PIL import Image, ImageOps
from pypdf import PdfReader
from docx import Document
from pptx import Presentation
import pytesseract

Image.MAX_IMAGE_PIXELS = 4_000_000
MAX_TEXT = 1_000_000
MAX_UNITS = 500


class ExtractionError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def validate_office(path: str, kind: str) -> None:
    with open(path, "rb") as source:
        if source.read(8) == bytes.fromhex("d0cf11e0a1b11ae1"):
            raise ExtractionError("PASSWORD_PROTECTED")
    main = "word/document.xml" if kind == "DOCX" else "ppt/presentation.xml"
    expected = ("application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
                if kind == "DOCX" else "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml")
    with zipfile.ZipFile(path) as package:
        entries = package.infolist()
        if not 3 <= len(entries) <= 1000:
            raise ExtractionError("UNSAFE_DOCUMENT")
        names: set[str] = set()
        expanded = 0
        has_main = has_type = has_root = False
        for entry in entries:
            name = entry.filename
            lower = name.lower()
            if (name in names or name.startswith("/") or "\\" in name or ".." in PurePosixPath(name).parts
                    or any(x in lower for x in ("vbaproject", "embeddings/", "activex/"))
                    or (lower.endswith(".bin") and not re.fullmatch(r"(?:ppt|word)/printersettings/printersettings\d+\.bin", lower))):
                raise ExtractionError("UNSAFE_DOCUMENT")
            names.add(name)
            if entry.is_dir():
                continue
            if (entry.flag_bits & 1 or entry.file_size > 16 * 1024 * 1024
                    or entry.file_size > max(1, entry.compress_size) * 100):
                raise ExtractionError("UNSAFE_DOCUMENT")
            expanded += entry.file_size
            if expanded > 48 * 1024 * 1024:
                raise ExtractionError("UNSAFE_DOCUMENT")
            # Read every member, including media, to verify CRC. Never extract paths to disk.
            with package.open(entry) as member:
                data = member.read(16 * 1024 * 1024 + 1)
            if len(data) != entry.file_size:
                raise ExtractionError("CORRUPT_DOCUMENT")
            if not lower.endswith((".xml", ".rels")):
                continue
            root = ElementTree.fromstring(data)
            if name == main:
                ns = ("http://schemas.openxmlformats.org/wordprocessingml/2006/main"
                      if kind == "DOCX" else "http://schemas.openxmlformats.org/presentationml/2006/main")
                local = "document" if kind == "DOCX" else "presentation"
                if root.tag != f"{{{ns}}}{local}":
                    raise ExtractionError("CORRUPT_DOCUMENT")
                has_main = True
            if name == "[Content_Types].xml":
                for node in root:
                    content = node.attrib.get("ContentType", "")
                    if "macroenabled" in content.lower():
                        raise ExtractionError("UNSAFE_DOCUMENT")
                    if node.attrib.get("PartName") == "/" + main and content == expected:
                        has_type = True
            if lower.endswith(".rels"):
                for node in root:
                    rel = node.attrib.get("Type", "")
                    if node.attrib.get("TargetMode") == "External" and not rel.endswith("/hyperlink"):
                        raise ExtractionError("UNSAFE_DOCUMENT")
                    if name == "_rels/.rels" and rel.endswith("/officeDocument") and node.attrib.get("Target") == main:
                        has_root = True
        if not (has_main and has_type and has_root):
            raise ExtractionError("CORRUPT_DOCUMENT")


def extract(path: str, kind: str) -> dict:
    try:
        fragments: list[dict] = []
        total = 0

        def add(text: str, unit_type: str, number: int) -> None:
            nonlocal total
            text = text.replace("\x00", "").strip()
            if not text:
                return
            total += len(text) + 2
            if total > MAX_TEXT or len(fragments) >= 2000:
                raise ExtractionError("TEXT_LIMIT")
            # Bound each Mongo fragment; retain the source page/slide/section when split.
            for start in range(0, len(text), 60_000):
                fragments.append({"index": len(fragments), "unitType": unit_type,
                                  "unitNumber": number, "text": text[start:start + 60_000]})

        if kind == "PDF":
            with open(path, "rb") as source:
                if source.read(5) != b"%PDF-":
                    raise ExtractionError("CORRUPT_DOCUMENT")
            pdf = PdfReader(path, strict=True)
            if pdf.is_encrypted:
                raise ExtractionError("PASSWORD_PROTECTED")
            # Defense in depth if this internal parser is called independently of Spring.
            seen = set()

            def inspect(node, depth=0):
                if depth > 100 or len(seen) > 200_000:
                    raise ExtractionError("UNSAFE_DOCUMENT")
                if id(node) in seen:
                    return
                seen.add(id(node))
                if hasattr(node, "get_object"):
                    resolved = node.get_object()
                    if resolved is not node:
                        inspect(resolved, depth + 1)
                        return
                if isinstance(node, dict):
                    if set(node) & {"/JS", "/JavaScript", "/OpenAction", "/AA", "/EmbeddedFiles", "/RichMedia", "/XFA"}:
                        raise ExtractionError("UNSAFE_DOCUMENT")
                    if node.get("/S") in ("/JavaScript", "/Launch", "/SubmitForm", "/ImportData", "/GoToR"):
                        raise ExtractionError("UNSAFE_DOCUMENT")
                    for value in node.values():
                        inspect(value, depth + 1)
                elif isinstance(node, (list, tuple)):
                    for value in node:
                        inspect(value, depth + 1)

            inspect(pdf.trailer)
            count = len(pdf.pages)
            if not 1 <= count <= MAX_UNITS:
                raise ExtractionError("UNSAFE_DOCUMENT")
            for index, page in enumerate(pdf.pages, 1):
                content = page.get_contents()
                if content is not None and len(content.get_data()) > 8 * 1024 * 1024:
                    raise ExtractionError("UNSAFE_DOCUMENT")
                add(page.extract_text() or "", "page", index)
        elif kind in ("DOCX", "PPTX"):
            validate_office(path, kind)
            if kind == "DOCX":
                doc = Document(path)
                # Preserve body order, including table cells; section boundaries follow sectPr.
                sections: list[list[str]] = [[]]
                for block in doc.element.body:
                    name = block.tag.rsplit("}", 1)[-1]
                    if name in ("p", "tbl"):
                        texts = block.xpath(".//w:t")
                        sections[-1].append(" ".join(t.text or "" for t in texts))
                        if block.xpath(".//w:pPr/w:sectPr"):
                            sections.append([])
                if not sections[-1] and len(sections) > 1:
                    sections.pop()
                count = len(sections)
                if count > MAX_UNITS:
                    raise ExtractionError("UNSAFE_DOCUMENT")
                for index, paragraphs in enumerate(sections, 1):
                    add("\n".join(paragraphs), "section", index)
            else:
                deck = Presentation(path)
                count = len(deck.slides)
                if not 1 <= count <= MAX_UNITS:
                    raise ExtractionError("UNSAFE_DOCUMENT")

                def shape_text(shapes):
                    for shape in shapes:
                        if shape.has_text_frame:
                            yield shape.text_frame.text
                        if shape.has_table:
                            for row in shape.table.rows:
                                yield " | ".join(cell.text for cell in row.cells)
                        if hasattr(shape, "shapes"):
                            yield from shape_text(shape.shapes)

                for index, slide in enumerate(deck.slides, 1):
                    add("\n".join(shape_text(slide.shapes)), "slide", index)
        elif kind in ("JPEG", "PNG"):
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(path) as image:
                    if image.format != ("JPEG" if kind == "JPEG" else "PNG"):
                        raise ExtractionError("CORRUPT_DOCUMENT")
                    if image.width * image.height > Image.MAX_IMAGE_PIXELS:
                        raise ExtractionError("UNSAFE_DOCUMENT")
                    image.verify()
                with Image.open(path) as image:
                    image = ImageOps.exif_transpose(image).convert("RGB")
                    add(pytesseract.image_to_string(image, lang="spa", config="--psm 6", timeout=12), "image", 1)
            count = 1
        else:
            raise ExtractionError("UNSUPPORTED_FORMAT")
        if not fragments:
            raise ExtractionError("NO_EXTRACTABLE_TEXT")
        return {"fileType": kind, "text": "\n\n".join(part["text"] for part in fragments),
                "fragments": fragments, "unitCount": count, "warnings": [], "extractionStatus": "READY"}
    except ExtractionError:
        raise
    except pytesseract.TesseractNotFoundError:
        raise ExtractionError("OCR_UNAVAILABLE") from None
    except pytesseract.TesseractError:
        raise ExtractionError("OCR_UNAVAILABLE") from None
    except RuntimeError:
        raise ExtractionError("EXTRACTION_TIMEOUT") from None
    except (Image.DecompressionBombError, Image.DecompressionBombWarning, MemoryError):
        raise ExtractionError("UNSAFE_DOCUMENT") from None
    except Exception:
        raise ExtractionError("CORRUPT_DOCUMENT") from None
