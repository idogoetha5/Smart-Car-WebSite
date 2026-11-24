from pathlib import Path
from html import escape, unescape
import re

forms = Path(__file__).resolve().parents[2] / 'public' / 'forms'
s = (forms / 'declaration.html').read_text()
s = re.sub(r'data-en="([^"]*)">([^<]*)<', lambda m:
    'data-he="' + escape(unescape(m[2]), quote=True) + '">' + escape(unescape(m[1]), quote=False) + '<', s)
for attr, suffix in (('aria-label', 'aria'), ('title', 'title')):
    s = re.sub(rf'{attr}="([^"]*)" data-en-{suffix}="([^"]*)"', lambda m:
        f'{attr}="{m[2]}" data-he-{suffix}="{m[1]}"', s)
changes = {
    '<html lang="he" dir="rtl">': '<html lang="en" dir="ltr">',
    'id="language" type="button" lang="en" aria-label="Switch to English" disabled>English': 'id="language" type="button" lang="he" aria-label="מעבר לעברית" disabled>עברית',
    '<title>הצהרה והתחיבות | SmartCar</title>': '<title>Declaration and undertaking | SmartCar</title>',
    'טופס הצהרה והתחיבות להשכרת רכב של סמארט קאר. מילוי, עיון וחתימה ישירות מהטלפון.': 'SmartCar rental declaration and undertaking. Enter your details, review the declaration and sign on your phone.',
    'rel="canonical" href="https://www.smartcar.co.il/declaration"': 'rel="canonical" href="https://www.smartcar.co.il/declaration/en"',
    'property="og:url" content="https://www.smartcar.co.il/declaration"': 'property="og:url" content="https://www.smartcar.co.il/declaration/en"',
    'property="og:locale" content="he_IL"': 'property="og:locale" content="en_GB"',
    'property="og:locale:alternate" content="en_GB"': 'property="og:locale:alternate" content="he_IL"',
    'SmartCar | הצהרה והתחיבות': 'SmartCar | Declaration and Undertaking',
    'property="og:description" content="טופס השכרת רכב של סמארט קאר."': 'property="og:description" content="SmartCar vehicle rental form."',
    'declaration-share-v1.jpg': 'declaration-share-en-v1.jpg',
    'סמארט קאר, הצהרה והתחיבות להשכרת רכב': 'SmartCar rental declaration and undertaking',
    'www.smartcar.co.il/he/contact': 'www.smartcar.co.il/en/contact',
}
for old, new in changes.items():
    assert old in s, old
    s = s.replace(old, new, 1)
(forms / 'declaration-en.html').write_text(s)
