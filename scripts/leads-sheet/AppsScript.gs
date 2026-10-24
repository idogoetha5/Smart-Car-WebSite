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
    if (!sheet) throw new Error('Lead sheet missing; sync stopped to preserve data.');
    var headerOffset = sheet.getRange(1, 7, Math.min(20, sheet.getMaxRows()), 1).getDisplayValues().findIndex(function (r) { return r[0] === 'מפתח ייחודי'; });
    if (headerOffset < 0) throw new Error('Lead key header missing; sync stopped to preserve data.');
    var headerRow = headerOffset + 1;
    var dataRow = headerRow + 1;
    var ledger = book.getSheetByName('_smartcar_sync');
    if (!ledger) {
      ledger = book.insertSheet('_smartcar_sync');
      ledger.getRange(1, 1).setValue('Imported lead key');
      // The workbook was backfilled on this date before sync was installed.
      // Remember that original snapshot, including rows the owner has since
      // removed. Leads created after the snapshot are still appended below.
      var baseline = body.rows.filter(function (row) { return new Date(row.createdAt).getTime() <= Date.parse('2026-10-19T15:23:00Z'); });
      if (baseline.length) ledger.getRange(2, 1, baseline.length, 1).setValues(baseline.map(function (row) { return [row.key]; }));
      ledger.hideSheet();
    }
    var seen = new Set();
    if (ledger.getLastRow() > 1) ledger.getRange(2, 1, ledger.getLastRow() - 1, 1).getDisplayValues().forEach(function (r) { if (r[0]) seen.add(r[0]); });
    // Seed from the existing import. The ledger also remembers manually
    // deleted rows, so a deletion in the working sheet stays deleted.
    var current = sheet.getLastRow() >= dataRow ? sheet.getRange(dataRow, 7, sheet.getLastRow() - headerRow, 1).getDisplayValues() : [];
    var seed = [];
    current.forEach(function (r) { if (r[0] && !seen.has(r[0])) { seen.add(r[0]); seed.push([r[0]]); } });
    if (seed.length) ledger.getRange(ledger.getLastRow() + 1, 1, seed.length, 1).setValues(seed);
    var fresh = body.rows.filter(function (row) { return !seen.has(row.key); }).sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
    // Write the working rows before the ledger. If Google fails between these
    // writes, the next run recovers the keys from the working sheet.
    if (fresh.length) {
      // Insert whole rows so every manual column/note stays with its lead.
      // New enquiries must not disappear below months of existing history.
      var filter = sheet.getFilter();
      var criteria = [];
      if (filter) {
        for (var column = 1; column <= 6; column++) criteria[column] = filter.getColumnFilterCriteria(column);
        filter.remove();
      }
      sheet.insertRowsBefore(dataRow, fresh.length);
      var start = dataRow;
      var range = sheet.getRange(start, 1, fresh.length, 7);
      sheet.getRange(dataRow + fresh.length, 1, 1, 7).copyTo(range, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      var safe = function (value) { var text = String(value == null ? '' : value); return /^[=+\-@]/.test(text) ? "'" + text : text; };
      range.setNumberFormat('@');
      range.setValues(fresh.map(function (r) {
        return [r.source, r.name, r.phone, r.email, r.createdAt, r.details, r.key].map(safe);
      }));
      ledger.getRange(ledger.getLastRow() + 1, 1, fresh.length, 1).setValues(fresh.map(function (r) { return [r.key]; }));
      var nextFilter = sheet.getRange(headerRow, 1, sheet.getLastRow() - headerRow + 1, 6).createFilter();
      for (var c = 1; c <= 6; c++) if (criteria[c]) nextFilter.setColumnFilterCriteria(c, criteria[c]);
    }
    // One-time repair of the old import/new-at-bottom ordering. Sort complete
    // rows, including the hidden key and any office-added columns; never rewrite
    // customer cells. Later runs leave the owner's existing ordering alone.
    if (props.getProperty('LEADS_NEWEST_FIRST_V2') !== 'true') {
      var size = sheet.getLastRow() - headerRow;
      if (size > 1) sheet.getRange(dataRow, 1, size, sheet.getLastColumn()).sort({ column: 5, ascending: false });
      props.setProperty('LEADS_NEWEST_FIRST_V2', 'true');
    }
    var stamp = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'dd/MM/yyyy HH:mm');
    sheet.getRange('A1').setNote('סנכרון אחרון: ' + stamp + ' · פניות חדשות נוספות כל 5 דקות');
    // Replace only the original generated summary, never an owner's own title.
    if (headerRow > 1) {
      var summary = sheet.getRange(headerRow - 1, 1);
      if (/^(עודכן |סנכרון אחרון:)/.test(String(summary.getValue()))) {
        var keys = sheet.getLastRow() >= dataRow ? sheet.getRange(dataRow, 7, sheet.getLastRow() - headerRow, 1).getDisplayValues().filter(function (r) { return Boolean(r[0]); }) : [];
        var contacts = keys.filter(function (r) { return r[0].indexOf('contact:') === 0; }).length;
        summary.setValue('סנכרון אחרון: ' + stamp + ' · ' + keys.length + ' פניות · ' + contacts + ' צור קשר');
      }
    }
    props.setProperty('LAST_SUCCESS_AT', new Date().toISOString());
    props.setProperty('LAST_ADDED_COUNT', String(fresh.length));
    console.log('Lead sync succeeded; added ' + fresh.length + ' rows.');
  } finally {
    lock.releaseLock();
  }
}
