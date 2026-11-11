"""Small synthetic documents; no downloaded material or personal information."""
import io
from pathlib import Path

from docx import Document
from pptx import Presentation
from pptx.util import Inches
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
from PIL import Image, ImageDraw, ImageFont


def pdf_bytes(text=True, password=False):
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    if text:
        font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
        content = DecodedStreamObject()
        content.set_data(b"BT /F1 18 Tf 50 700 Td (Aprender ciencias con SIARE) Tj ET")
        page[NameObject("/Contents")] = writer._add_object(content)
    if password:
        writer.encrypt("fixture-password")
    output = io.BytesIO(); writer.write(output)
    return output.getvalue()


def fixtures():
    word = Document(); word.add_heading("Ciencias", 0); word.add_paragraph("La energia se conserva. Aprender con SIARE.")
    table = word.add_table(rows=1, cols=2); table.cell(0, 0).text = "Materia"; table.cell(0, 1).text = "Ciencias"
    docx = io.BytesIO(); word.save(docx)
    deck = Presentation(); slide = deck.slides.add_slide(deck.slide_layouts[5]); slide.shapes.title.text = "Ciencias SIARE"
    slide.shapes.add_textbox(Inches(1), Inches(2), Inches(8), Inches(2)).text = "La energia se conserva."
    pptx = io.BytesIO(); deck.save(pptx)
    image = Image.new("RGB", (1100, 260), "white")
    # Use a local system font when available; Docker's Tesseract package installs DejaVu.
    font = None
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:/Windows/Fonts/arial.ttf"):
        if Path(path).is_file():
            font = ImageFont.truetype(path, 48); break
    ImageDraw.Draw(image).text((30, 70), "Aprender ciencias con SIARE", fill="black", font=font or ImageFont.load_default(size=48))
    result = {"academic.pdf": pdf_bytes(), "academic.docx": docx.getvalue(), "academic.pptx": pptx.getvalue(),
              "scanned.pdf": pdf_bytes(False), "protected.pdf": pdf_bytes(password=True)}
    for ext, format in (("png", "PNG"), ("jpg", "JPEG"), ("jpeg", "JPEG")):
        output = io.BytesIO(); image.save(output, format=format); result["academic." + ext] = output.getvalue()
    return result


if __name__ == "__main__":
    import sys
    target = Path(sys.argv[1]); target.mkdir(parents=True, exist_ok=True)
    for name, data in fixtures().items():
        (target / name).write_bytes(data)
    print("Synthetic PDF, DOCX, PPTX and OCR fixtures generated.")
