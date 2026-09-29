const SPREADSHEET_ID = '1AI2rp4mvt7q3uzyN-WfbBayEtO2mvIyHoEqXBSRBuLU';
const SHEET_NAME = 'טפסי תל אביב';
const HEADERS = [
  'מזהה טופס',
  'תאריך קליטה',
  'שם מלא',
  'תאריך לידה',
  'ת״ז / דרכון',
  'מספר רישיון נהיגה',
  'מדינה',
  'עיר',
  'כתובת מגורים',
  'מיקוד',
  'מספר טלפון',
  'כתובת בישראל',
  'אימייל',
  'שפה',
];

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeCell(value) {
  const text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function getTargetSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground('#2D5F5F')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    sheet.setRightToLeft(true);
    sheet.autoResizeColumns(1, HEADERS.length);
  }
  return sheet;
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    const payload = JSON.parse((event && event.postData && event.postData.contents) || '{}');
    const expectedSecret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (!expectedSecret || payload.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: 'Unauthorized' });
    }

    const row = payload.row || {};
    if (!row.id || !row.fullName || !row.email) {
      return jsonResponse({ ok: false, error: 'Missing required fields' });
    }

    lock.waitLock(20000);
    const sheet = getTargetSheet();
    const existing = sheet.getRange('A:A').createTextFinder(String(row.id)).matchEntireCell(true).findNext();
    if (existing) return jsonResponse({ ok: true, duplicate: true });

    sheet.appendRow([
      safeCell(row.id),
      safeCell(row.createdAt),
      safeCell(row.fullName),
      safeCell(row.dateOfBirth),
      safeCell(row.passportNumber),
      safeCell(row.driverLicenseNumber),
      safeCell(row.country),
      safeCell(row.city),
      safeCell(row.address),
      safeCell(row.postalCode),
      safeCell(row.phone),
      safeCell(row.israelAddress),
      safeCell(row.email),
      safeCell(row.locale),
    ]);
    SpreadsheetApp.flush();
    return jsonResponse({ ok: true, duplicate: false });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message ? error.message : error) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function doGet() {
  return jsonResponse({ ok: false, error: 'POST only' });
}
