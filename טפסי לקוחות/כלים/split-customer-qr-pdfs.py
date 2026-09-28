from pathlib import Path

from pypdf import PdfReader, PdfWriter


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "טפסי לקוחות" / "חוברות להדפסה" / "smart-car-customer-form-qr-booklet.pdf"
OUTPUT_DIR = ROOT / "טפסי לקוחות" / "חוברות להדפסה"

OUTPUTS = [
    "טופס-לקוחות-הרצליה.pdf",
    "טופס-לקוחות-תל-אביב.pdf",
    "טופס-לקוחות-ירושלים.pdf",
    "טופס-לקוחות-נתבג.pdf",
]


def main() -> None:
    reader = PdfReader(SOURCE)
    if len(reader.pages) != len(OUTPUTS):
        raise ValueError(f"Expected {len(OUTPUTS)} pages, found {len(reader.pages)}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for page, filename in zip(reader.pages, OUTPUTS, strict=True):
        writer = PdfWriter()
        writer.add_page(page)
        writer.add_metadata({
            "/Title": filename.removesuffix(".pdf"),
            "/Author": "Smart Car",
        })
        with (OUTPUT_DIR / filename).open("wb") as stream:
            writer.write(stream)

    for filename in OUTPUTS:
        print(OUTPUT_DIR / filename)


if __name__ == "__main__":
    main()
