/** @OnlyCurrentDoc */
/** Bound to the leads workbook. Credentials live only in Script Properties. */
function installLeadSync() {
  syncSmartCarLeads();
  var exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'syncSmartCarLeads';
  });
  if (!exists) ScriptApp.newTrigger('syncSmartCarLeads').timeBased().everyMinutes(5).create();
}

function syncSmartCarLeads() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('LEADS_SYNC_SECRET');
    if (!secret) throw new Error('Set LEADS_SYNC_SECRET in Script Properties first.');
    var response = UrlFetchApp.fetch('https://www.smartcar.co.il/api/integrations/leads', {
      headers: { Authorization: 'Bearer ' + secret }, muteHttpExceptions: true,
    });
    if (response.getResponseCode() !== 200) throw new Error('SmartCar feed unavailable: ' + response.getResponseCode());
    var body = JSON.parse(response.getContentText());
    if (body.ok !== true || !Array.isArray(body.rows)) throw new Error('Invalid lead feed');
    var book = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = book.getSheetByName('לידים');
    if (!sheet || sheet.getRange('G4').getValue() !== 'מפתח ייחודי') throw new Error('Lead sheet structure changed; sync stopped to preserve data.');
    var ledger = book.getSheetByName('_smartcar_sync');
    if (!ledger) {
      ledger = book.insertSheet('_smartcar_sync');
      ledger.getRange(1, 1).setValue('Imported lead key');
      ledger.hideSheet();
    }
    var seen = new Set();
    if (ledger.getLastRow() > 1) ledger.getRange(2, 1, ledger.getLastRow() - 1, 1).getDisplayValues().forEach(function (r) { if (r[0]) seen.add(r[0]); });
    // Seed from the existing import. The ledger also remembers manually
    // deleted rows, so a deletion in the working sheet stays deleted.
    var current = sheet.getLastRow() > 4 ? sheet.getRange(5, 7, sheet.getLastRow() - 4, 1).getDisplayValues() : [];
    var seed = [];
    current.forEach(function (r) { if (r[0] && !seen.has(r[0])) { seen.add(r[0]); seed.push([r[0]]); } });
    if (seed.length) ledger.getRange(ledger.getLastRow() + 1, 1, seed.length, 1).setValues(seed);
    var fresh = body.rows.filter(function (row) { return !seen.has(row.key); });
    // Write the working rows before the ledger. If Google fails between these
    // writes, the next run recovers the keys from the working sheet.
    if (fresh.length) {
      var start = Math.max(5, sheet.getLastRow() + 1);
      var end = start + fresh.length - 1;
      if (end > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), end - sheet.getMaxRows());
      var range = sheet.getRange(start, 1, fresh.length, 7);
      sheet.getRange(5, 1, 1, 7).copyTo(range, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      var safe = function (value) { var text = String(value == null ? '' : value); return /^[=+\-@]/.test(text) ? "'" + text : text; };
      range.setNumberFormat('@');
      range.setValues(fresh.map(function (r) {
        return [r.source, r.name, r.phone, r.email, r.createdAt, r.details, r.key].map(safe);
      }));
      ledger.getRange(ledger.getLastRow() + 1, 1, fresh.length, 1).setValues(fresh.map(function (r) { return [r.key]; }));
      var filter = sheet.getFilter();
      if (filter) filter.remove();
      sheet.getRange(4, 1, end - 3, 6).createFilter();
    }
    var stamp = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'dd/MM/yyyy HH:mm');
    sheet.getRange('A3').setValue('סנכרון אחרון: ' + stamp + ' · פניות חדשות נוספות כל 5 דקות');
    props.setProperty('LAST_SUCCESS_AT', new Date().toISOString());
    props.setProperty('LAST_ADDED_COUNT', String(fresh.length));
    console.log('Lead sync succeeded; added ' + fresh.length + ' rows.');
  } finally {
    lock.releaseLock();
  }
}
