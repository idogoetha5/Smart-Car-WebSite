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
const preview = !['www.smartcar.co.il', 'smartcar.co.il'].includes(location.hostname);
const submitButton = document.querySelector('#submit-declaration');
const verification = document.querySelector('#verification');
const deliveryStatus = document.querySelector('#delivery-status');

const labels = {
  name: ['שם מלא', 'Full name'],
  idNumber: ['תעודת זהות', 'Israeli ID number'],
  street: ['רחוב ומספר בית', 'Street and house number'],
  city: ['עיר', 'City'],
  start: ['תחילת ההשכרה', 'Rental start date'],
  end: ['סיום ההשכרה', 'Rental end date'],
  cardHolder: ['המחזיק הרשום בכרטיס אשראי', 'Registered cardholder'],
  cardNumber: ['מספר כרטיס אשראי', 'Card number'],
  cardExpiry: ['תוקף', 'Card expiry'],
  signedDate: ['תאריך ביצוע העסקה ו/או החתימה', 'Date of transaction and/or signature'],
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
let submissionId;
let portalLoad;
let widget;
let verificationToken;
let officeNotified;
let submitting = false;

function tr(he, en) {
  return english ? en : he;
}

function displayDate(value) {
  if (english) return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
  return value.split('-').reverse().join('.');
}

function visibleValue(name) {
  const value = fields.namedItem(name).value;
  if (name === 'cardNumber') return value ? '•••• ' + value.replace(/\D/g, '').slice(-4) : '';
  return value && ['start', 'end', 'signedDate'].includes(name) ? displayDate(value) : value;
}

function populateTerms(target, signature) {
  for (const item of target.querySelectorAll('[data-en], [data-he]')) {
    if (!item.textContent.includes('{')) continue;
    const output = document.createDocumentFragment();
    for (const part of item.textContent.split(/(\{\w+\})/g)) {
      const field = part.startsWith('{') ? part.slice(1, -1) : '';
      if (field === 'signature') output.append(signature?.cloneNode(true) ?? '_____');
      else if (field && Object.prototype.hasOwnProperty.call(labels, field)) {
        const value = document.createElement('bdi');
        value.className = 'printed-field';
        value.textContent = visibleValue(field) || '_____';
        output.append(value);
      } else output.append(part);
    }
    item.replaceChildren(output);
  }
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
    entry.textContent = visibleValue(name);
    entry.dir = 'auto';
    row.append(key, entry);
    list.append(row);
  }
  reviewData.replaceChildren(list);
  const terms = document.querySelector('.terms');
  for (const { node, he, en } of translatedNodes) {
    if (terms.contains(node)) node.textContent = tr(he, en);
  }
  populateTerms(terms);
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
  const heading = document.querySelector(['#details-title', '#review-title', '#result-title'][step]);
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ block: 'start' });
}

function checkDetails() {
  for (const input of detailInputs) {
    if (input.type !== 'date') input.value = input.value.trim();
  }
  fields.end.setCustomValidity(fields.start.value > fields.end.value
    ? tr('תאריך הסיום צריך להיות אחרי תאריך ההתחלה או באותו יום.', 'The end date must be on or after the start date.') : '');
  const cardValid = /^[0-9 ]+$/.test(fields.cardNumber.value) && /^\d{8,19}$/.test(fields.cardNumber.value.replace(/ /g, ''));
  fields.cardNumber.setCustomValidity(cardValid ? '' : tr('יש לבדוק את מספר הכרטיס.', 'Check the card number.'));
  const expiryValid = /^(0[1-9]|1[0-2])\/\d{2}$/.test(fields.cardExpiry.value);
  fields.cardExpiry.setCustomValidity(expiryValid ? '' : tr('יש להזין תוקף בפורמט חודש/שנה.', 'Enter the expiry date as MM/YY.'));
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
    ? tr('הצהרה והתחיבות · דוגמה', 'Declaration and undertaking · Demo')
    : tr('הצהרה והתחיבות', 'Declaration and undertaking');
  const sourceTerms = document.querySelector('.terms');
  const terms = sourceTerms.cloneNode(true);
  const translatedTerms = [...terms.querySelectorAll('[data-en], [data-he]')];
  translatedNodes.filter(({ node }) => sourceTerms.contains(node)).forEach(({ he, en }, index) => {
    translatedTerms[index].textContent = tr(he, en);
  });
  if (typedMode.checked) {
    const name = document.createElement('bdi');
    name.textContent = typedName;
    populateTerms(terms, name);
  } else {
    const picture = document.createElement('img');
    picture.src = canvas.toDataURL('image/png');
    picture.alt = tr('חתימת החותם', 'Signer’s signature');
    populateTerms(terms, picture);
  }
  signedDocument.dir = document.documentElement.dir;
  signedDocument.lang = document.documentElement.lang;
  signedDocument.replaceChildren(logo, title, terms);
}

function showError(he, en) {
  error.textContent = tr(he, en);
  error.hidden = false;
}

async function loadVerification() {
  if (preview || widget !== undefined || portalLoad) return;
  verification.hidden = false;
  portalLoad = (async () => {
    const response = await fetch('/api/declaration', { cache: 'no-store' });
    const config = await response.json();
    if (!response.ok || !config.siteKey) throw new Error('Missing verification setup');
    if (!window.turnstile) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.addEventListener('load', resolve, { once: true });
        script.addEventListener('error', () => { script.remove(); reject(); }, { once: true });
        document.head.append(script);
      });
    }
    widget = window.turnstile.render(verification, {
      sitekey: config.siteKey,
      language: tr('he', 'en'),
      callback: (token) => { verificationToken = token; error.hidden = true; },
      'expired-callback': () => { verificationToken = undefined; },
      'error-callback': () => { verificationToken = undefined; return true; },
    });
  })();
  try {
    await portalLoad;
  } catch {
    showError('אימות השליחה לא נטען. אפשר לנסות לשלוח שוב.', 'Verification could not load. Try submitting again.');
  } finally {
    portalLoad = undefined;
  }
}

function showDelivery() {
  deliveryStatus.textContent = preview
    ? tr('זו תצוגת ניסיון. העותק לא נשלח.', 'This is a demo. Your copy was not sent.')
    : officeNotified
      ? tr('הטופס נשמר והועבר לשליחה למשרד.', 'The form was saved and sent to the office email service.')
      : tr('הטופס נשמר במערכת של סמארט קאר.', 'The form was saved in SmartCar’s system.');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (step === 0) {
    if (!checkDetails()) return;
    renderDetails();
    showStep(1);
    void loadVerification();
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
  if (submitting) return;
  if (!preview) {
    if (!verificationToken) {
      showError('יש להשלים את האימות לפני השליחה.', 'Complete the verification before submitting.');
      void loadVerification();
      return;
    }
    submitting = true;
    submitButton.disabled = true;
    review.inert = true;
    submitButton.setAttribute('aria-busy', 'true');
    languageButton.disabled = true;
    document.querySelector('#edit').disabled = true;
    try {
      submissionId ??= crypto.randomUUID();
      const response = await fetch('/api/declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: submissionId, locale: tr('he', 'en'), confirmed: fields.confirmed.checked, token: verificationToken,
          fields: Object.fromEntries(detailInputs.map((input) => [input.name, input.value])),
          signature: typedMode.checked ? { type: 'typed', name: typedName } : { type: 'drawn', png: canvas.toDataURL('image/png') },
        }),
      });
      const receipt = await response.json();
      if (!response.ok) {
        if (receipt.error === 'invalid') {
          showError('יש לבדוק את פרטי הטופס, לרבות מספר הכרטיס והתוקף.', 'Check the form details, including the card number and expiry.');
        } else showError('לא הצלחנו להשלים את השליחה. אפשר לנסות שוב.', 'The form could not be submitted. Please try again.');
        return;
      }
      officeNotified = receipt.officeNotified;
    } catch {
      showError('לא הצלחנו להשלים את השליחה. אפשר לנסות שוב.', 'The form could not be submitted. Please try again.');
      return;
    } finally {
      submitting = false;
      verificationToken = undefined;
      if (widget !== undefined) window.turnstile.reset(widget);
      submitButton.disabled = false;
      review.inert = false;
      submitButton.removeAttribute('aria-busy');
      languageButton.disabled = false;
      document.querySelector('#edit').disabled = false;
    }
  }
  createDocument(typedName);
  fields.cardNumber.value = '';
  showDelivery();
  showStep(2);
});

form.addEventListener('input', (event) => {
  if (event.target === fields.start || event.target === fields.end) fields.end.setCustomValidity('');
  if (event.target === fields.cardNumber) {
    fields.cardNumber.value = fields.cardNumber.value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
    fields.cardNumber.setCustomValidity('');
  }
  if (event.target === fields.cardExpiry) {
    const digits = fields.cardExpiry.value.replace(/\D/g, '');
    const year = digits.length === 6 ? digits.slice(4) : digits.slice(2, 4);
    fields.cardExpiry.value = year ? digits.slice(0, 2) + '/' + year : digits.slice(0, 2);
    fields.cardExpiry.setCustomValidity('');
  }
  if (company.contains(event.target)) fields.companyName.required = false;
});
company.addEventListener('invalid', () => { company.open = true; }, true);
typedMode.addEventListener('change', updateSignatureMode);
document.querySelector('#clear').addEventListener('click', clearSignature);
for (const id of ['edit', 'correct']) {
  document.querySelector('#' + id).addEventListener('click', () => {
    clearSignature();
    submissionId = undefined;
    showStep(0);
  });
}
document.querySelector('#print').addEventListener('click', () => window.print());
languageButton.addEventListener('click', () => {
  english = !english;
  document.documentElement.lang = tr('he', 'en');
  document.documentElement.dir = tr('rtl', 'ltr');
  document.title = tr('הצהרה והתחיבות | SmartCar', 'Declaration and undertaking | SmartCar');
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
  fields.cardNumber.setCustomValidity('');
  fields.cardExpiry.setCustomValidity('');
  if (step === 0) return;
  if (step === 2) { showDelivery(); return; }
  submissionId = undefined;
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
