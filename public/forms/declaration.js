'use strict';

const form = document.querySelector('#declaration-form');
const details = document.querySelector('#details');
const review = document.querySelector('#review');
const result = document.querySelector('#result');
const company = document.querySelector('#company');
const fields = form.elements;
const detailInputs = [...details.querySelectorAll('input')];
const reviewData = document.querySelector('#review-data');
const steps = [...document.querySelectorAll('[data-step]')];
const canvas = document.querySelector('#signature');
const ink = canvas.getContext('2d');
const error = document.querySelector('#error');
const typedMode = document.querySelector('#typed-mode');
const signedDocument = document.querySelector('#signed-document');
const languageButton = document.querySelector('#language');
const translatedNodes = [...document.querySelectorAll('[data-en], [data-en-aria], [data-en-title], [data-he], [data-he-aria], [data-he-title]')].map((node) => ({
  node,
  he: node.dataset.he ?? node.textContent,
  en: node.dataset.en ?? node.textContent,
  heAria: node.dataset.heAria ?? node.getAttribute('aria-label'),
  enAria: node.dataset.enAria ?? node.getAttribute('aria-label'),
  heTitle: node.dataset.heTitle ?? node.getAttribute('title'),
  enTitle: node.dataset.enTitle ?? node.getAttribute('title'),
}));
const preview = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);

const labels = {
  name: ['שם מלא', 'Full name'],
  idNumber: ['תעודת זהות', 'Israeli ID number'],
  street: ['רחוב ומספר בית', 'Street and house number'],
  city: ['עיר', 'City'],
  start: ['תחילת ההשכרה', 'Rental start date'],
  end: ['סיום ההשכרה', 'Rental end date'],
  paymentRef: ['אסמכתת תשלום', 'Payment reference'],
  renter: ['השוכר לפי החוזה', 'Renter named in the agreement'],
  companyName: ['שם החברה או הגוף', 'Company or entity name'],
  companyNumber: ['מספר ח.פ.', 'Company registration number'],
  companyAddress: ['כתובת החברה', 'Company address'],
  companyPhone: ['טלפון החברה', 'Company phone number'],
};

let step = 0;
let activePointer = null;
let hasInk = false;
let english = document.documentElement.lang === 'en';

function tr(he, en) {
  return english ? en : he;
}

function displayDate(value) {
  if (english) return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
  return value.split('-').reverse().join('.');
}

function renderDetails() {
  const list = document.createDocumentFragment();
  for (const [name, label] of Object.entries(labels)) {
    const { value } = fields.namedItem(name);
    if (!value) continue;
    const row = document.createElement('div');
    const key = document.createElement('dt');
    const entry = document.createElement('dd');
    key.textContent = tr(...label);
    entry.textContent = name === 'start' || name === 'end' ? displayDate(value) : value;
    entry.dir = 'auto';
    row.append(key, entry);
    list.append(row);
  }
  reviewData.replaceChildren(list);
}

function showStep(nextStep) {
  step = nextStep;
  details.hidden = step !== 0;
  review.hidden = step !== 1;
  form.hidden = step === 2;
  result.hidden = step !== 2;
  detailInputs.forEach((input) => { input.disabled = step !== 0; });
  fields.confirmed.disabled = step !== 1;
  fields.typedSignature.disabled = step !== 1 || !typedMode.checked;
  fields.typedSignature.required = step === 1 && typedMode.checked;
  steps.forEach((item, index) => {
    if (index === step) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
  document.querySelector(['#details-title', '#review-title', '#result-title'][step]).focus();
}

function checkDetails() {
  for (const input of detailInputs) {
    if (input.type !== 'date') input.value = input.value.trim();
  }
  fields.end.setCustomValidity(fields.start.value > fields.end.value
    ? tr('תאריך הסיום צריך להיות אחרי תאריך ההתחלה או באותו יום.', 'The end date must be on or after the start date.') : '');
  const ref = fields.paymentRef.value.normalize('NFKC');
  const digitRuns = ref.match(/\d[\d\s\-‐‑–—]{11,}\d/g) ?? [];
  const looksLikeCard = digitRuns.some((part) => part.replace(/\D/g, '').length >= 13);
  fields.paymentRef.setCustomValidity(looksLikeCard
    ? tr('יש להזין אסמכתה בלבד. נראה שהוזן מספר כרטיס.', 'Enter the payment reference only. This looks like a card number.') : '');
  const extraFields = ['companyName', 'companyNumber', 'companyAddress', 'companyPhone'];
  const anyCompanyField = extraFields.some((name) => fields.namedItem(name).value);
  fields.companyName.required = anyCompanyField;
  if (!form.checkValidity() && anyCompanyField) company.open = true;
  return form.reportValidity();
}

function penPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return [
    (event.clientX - rect.left) * canvas.width / rect.width,
    (event.clientY - rect.top) * canvas.height / rect.height,
  ];
}

if (ink) {
  ink.strokeStyle = '#122f31';
  ink.lineCap = 'round';
  ink.lineJoin = 'round';
  ink.lineWidth = 4;
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || activePointer !== null) return;
    activePointer = event.pointerId;
    canvas.setPointerCapture(activePointer);
    ink.beginPath();
    ink.moveTo(...penPoint(event));
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointer) return;
    ink.lineTo(...penPoint(event));
    ink.stroke();
    hasInk = true;
    error.hidden = true;
  });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(eventName, (event) => {
      if (event.pointerId === activePointer) activePointer = null;
    });
  }
} else {
  typedMode.checked = true;
}

function clearSignature() {
  ink?.clearRect(0, 0, canvas.width, canvas.height);
  hasInk = false;
  fields.typedSignature.value = '';
  fields.confirmed.checked = false;
  error.hidden = true;
  signedDocument.replaceChildren();
}

function updateSignatureMode() {
  document.querySelector('#draw-signature').hidden = typedMode.checked;
  document.querySelector('#type-signature').hidden = !typedMode.checked;
  fields.typedSignature.disabled = !typedMode.checked;
  fields.typedSignature.required = typedMode.checked;
}

function createDocument(typedName) {
  const logo = document.querySelector('.identity img').cloneNode(true);
  const title = document.createElement('h1');
  title.textContent = preview
    ? tr('הצהרה והתחייבות · דוגמה', 'Declaration and undertaking · Demo')
    : tr('הצהרה והתחייבות', 'Declaration and undertaking');
  const data = reviewData.cloneNode(true);
  data.removeAttribute('id');
  const terms = document.querySelector('.terms').cloneNode(true);
  const signature = document.createElement('section');
  signature.className = 'document-signature';
  const stamp = document.createElement('p');
  const date = new Intl.DateTimeFormat(tr('he-IL', 'en-GB'), { dateStyle: 'medium', timeZone: 'Asia/Jerusalem' });
  stamp.textContent = tr('תאריך החתימה לפי שעון ישראל: ', 'Date signed (Israel time): ') + date.format(new Date());
  const confirmation = document.createElement('p');
  confirmation.textContent = document.querySelector('.confirm span').textContent;
  signature.append(stamp, confirmation);
  if (typedMode.checked) {
    const name = document.createElement('p');
    name.textContent = tr('חתימה בהקלדה: ', 'Typed signature: ') + typedName;
    signature.append(name);
  } else {
    const picture = document.createElement('img');
    picture.src = canvas.toDataURL('image/png');
    picture.alt = tr('חתימת החותם', 'Signer’s signature');
    signature.append(picture);
  }
  signedDocument.replaceChildren(logo, title, data, terms, signature);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (step === 0) {
    if (!checkDetails()) return;
    renderDetails();
    showStep(1);
    return;
  }
  const typedName = fields.typedSignature.value.trim();
  const signed = typedMode.checked ? typedName === fields.name.value : hasInk;
  if (!signed) {
    error.textContent = typedMode.checked
      ? tr('יש להקליד את השם המלא בדיוק כפי שנכתב בפרטי החותם.', 'Type your full name exactly as it appears in the signer details.')
      : tr('יש להוסיף חתימה במשטח החתימה או לבחור בחתימה בהקלדה.', 'Draw your signature or choose to sign by typing your name.');
    error.hidden = false;
    return;
  }
  createDocument(typedName);
  showStep(2);
});

form.addEventListener('input', (event) => {
  if (event.target === fields.start || event.target === fields.end) fields.end.setCustomValidity('');
  if (event.target === fields.paymentRef) fields.paymentRef.setCustomValidity('');
  if (company.contains(event.target)) fields.companyName.required = false;
});
company.addEventListener('invalid', () => { company.open = true; }, true);
typedMode.addEventListener('change', updateSignatureMode);
document.querySelector('#clear').addEventListener('click', clearSignature);
for (const id of ['edit', 'correct']) {
  document.querySelector('#' + id).addEventListener('click', () => {
    clearSignature();
    showStep(0);
  });
}
document.querySelector('#print').addEventListener('click', () => window.print());
languageButton.addEventListener('click', () => {
  english = !english;
  document.documentElement.lang = tr('he', 'en');
  document.documentElement.dir = tr('rtl', 'ltr');
  document.title = tr('הצהרה והתחייבות | SmartCar', 'Declaration and undertaking | SmartCar');
  languageButton.textContent = tr('English', 'עברית');
  languageButton.lang = tr('en', 'he');
  languageButton.setAttribute('aria-label', tr('Switch to English', 'מעבר לעברית'));
  for (const { node, he, en, heAria, enAria, heTitle, enTitle } of translatedNodes) {
    if (node.matches('[data-he], [data-en]')) node.textContent = tr(he, en);
    if (node.matches('[data-he-aria], [data-en-aria]')) node.setAttribute('aria-label', tr(heAria, enAria));
    if (node.matches('[data-he-title], [data-en-title]')) node.setAttribute('title', tr(heTitle, enTitle));
  }
  document.querySelector('footer a').href = 'https://www.smartcar.co.il/' + tr('he', 'en') + '/contact';
  fields.end.setCustomValidity('');
  fields.paymentRef.setCustomValidity('');
  if (step === 0) return;
  clearSignature();
  renderDetails();
  showStep(1);
});
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  form.reset();
  clearSignature();
  showStep(0);
  document.activeElement?.blur();
});
updateSignatureMode();
document.querySelector('.preview-note').hidden = !preview;
document.querySelector('#continue').disabled = false;
languageButton.disabled = false;
