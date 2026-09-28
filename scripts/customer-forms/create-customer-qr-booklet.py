from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "טפסי לקוחות" / "חוברות להדפסה" / "smart-car-customer-form-qr-booklet.pdf"
LOGO = ROOT / "public" / "images" / "logo.png"

BRANCHES = [
    ("herzliya", "Herzliya", "הרצליה"),
    ("telaviv", "Tel Aviv", "תל אביב"),
    ("jerusalem", "Jerusalem", "ירושלים"),
    ("airport", "Ben Gurion Airport", "נתב״ג"),
]

GREEN = HexColor("#285d5c")
MINT = HexColor("#e9f2ef")
DARK = HexColor("#173f3e")
GRAY = HexColor("#526462")


def rtl(text: str) -> str:
    """Sufficient bidi handling for the short, punctuation-free Hebrew labels here."""
    return text[::-1]


def register_fonts() -> tuple[str, str]:
    font_candidates = [
        Path("/System/Library/Fonts/ArialHB.ttc"),
        Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
        Path("/Library/Fonts/Arial.ttf"),
    ]
    bold_candidates = [
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
        Path("/Library/Fonts/Arial Bold.ttf"),
    ]

    regular = next(path for path in font_candidates if path.exists())
    bold = next((path for path in bold_candidates if path.exists()), regular)
    pdfmetrics.registerFont(TTFont("SmartRegular", str(regular), subfontIndex=0))
    pdfmetrics.registerFont(TTFont("SmartBold", str(bold), subfontIndex=0))
    return "SmartRegular", "SmartBold"


def draw_logo(c: canvas.Canvas, width: float, page_height: float) -> None:
    with Image.open(LOGO) as image:
        logo_width, logo_height = image.size
    target_width = 150
    target_height = target_width * logo_height / logo_width
    c.drawImage(
        str(LOGO),
        (width - target_width) / 2,
        page_height - 115,
        width=target_width,
        height=target_height,
        mask="auto",
        preserveAspectRatio=True,
    )


def create_booklet() -> None:
    regular, bold = register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    width, height = A4
    c = canvas.Canvas(str(OUTPUT), pagesize=A4)
    c.setTitle("Smart Car - Customer Details QR Booklet")
    c.setAuthor("Smart Car")

    for slug, english_name, hebrew_name in BRANCHES:
        c.setFillColor(MINT)
        c.rect(0, 0, width, height, fill=1, stroke=0)

        c.setFillColor(GREEN)
        c.roundRect(24, 24, width - 48, height - 48, 24, fill=1, stroke=0)
        c.setFillColor(white)
        c.roundRect(38, 38, width - 76, height - 76, 20, fill=1, stroke=0)

        draw_logo(c, width, height)

        c.setFillColor(DARK)
        c.setFont(bold, 21)
        c.drawCentredString(width / 2, height - 166, "CUSTOMER DETAILS")

        qr = ROOT / "public" / "images" / f"qr-customer-details-{slug}.png"
        qr_size = 310
        c.setFillColor(MINT)
        c.roundRect((width - qr_size - 28) / 2, 277, qr_size + 28, qr_size + 28, 18, fill=1, stroke=0)
        c.drawImage(
            str(qr),
            (width - qr_size) / 2,
            291,
            width=qr_size,
            height=qr_size,
            mask="auto",
            preserveAspectRatio=True,
        )

        c.setFillColor(DARK)
        c.setFont(bold, 18)
        c.drawCentredString(width / 2, 242, rtl("סרקו למילוי פרטי הלקוח"))
        c.setFont("Helvetica", 14)
        c.drawCentredString(width / 2, 218, "Scan to complete your customer details")

        c.setFillColor(GRAY)
        c.setFont("Helvetica", 10)
        c.drawCentredString(width / 2, 175, "smartcar.co.il")

        c.showPage()

    c.save()


if __name__ == "__main__":
    create_booklet()
    print(OUTPUT)
