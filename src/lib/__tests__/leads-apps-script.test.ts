import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

class FakeSheet {
  rows: string[][] = [];
  note = '';
  getLastRow() { return this.rows.length; }
  getMaxRows() { return 1000; }
  getLastColumn() { return Math.max(7, ...this.rows.map(row => row.length)); }
  hideSheet() { /* no-op */ }
  getFilter() { return null; }
  insertRowsAfter() { /* no-op */ }
  insertRowsBefore(row: number, count: number) { this.rows.splice(row - 1, 0, ...Array.from({length:count},()=>[])); }
  getRange(row: number | string, column = 1, count = 1, width = 1) {
    const start = typeof row === 'string' ? Number(row.slice(1)) - 1 : row - 1;
    const setValues = (values: string[][]) => {
      values.forEach((valuesRow, i) => {
        this.rows[start + i] ??= [];
        valuesRow.forEach((value, j) => { this.rows[start + i][column - 1 + j] = value; });
      });
    };
    return {
      getValue: () => this.rows[start]?.[column - 1] ?? '',
      getDisplayValues: () => Array.from({ length: count }, (_, i) => Array.from({ length: width }, (_, j) => this.rows[start + i]?.[column - 1 + j] ?? '')),
      setValues,
      setValue: (value: string) => setValues([[value]]),
      setNote: (value: string) => { this.note = value; },
      copyTo() { /* formatting only */ },
      setNumberFormat() { /* text formatting */ },
      createFilter() { return { setColumnFilterCriteria() {} }; },
      sort: ({column: key}: {column:number}) => {
        const sorted = this.rows.slice(start,start+count).sort((a,b)=>(b[key-1]||'').localeCompare(a[key-1]||''));
        this.rows.splice(start,count,...sorted);
      },
    };
  }
}

describe('bound lead sheet synchronization', () => {
  it('finds a moved header, preserves edits/deletions, appends new leads once and escapes formulas', () => {
    const sheet = new FakeSheet();
    sheet.rows = [['My own title'], ['מקור', 'שם מלא', 'טלפון', 'אימייל', 'תאריך קליטה', 'פרטים', 'מפתח ייחודי'], ['השכרה', 'Manually edited', '0501234567', '', '', 'Keep this note', 'booking:existing']];
    const tables: Record<string, FakeSheet> = { 'לידים': sheet };
    const properties = new Map<string, string>([['LEADS_SYNC_SECRET', 'test-credential']]);
    let rows = [
      { key: 'booking:existing', name: 'Original name', createdAt: '2026-10-18T10:00:00Z' },
      { key: 'booking:manually-deleted', name: 'Deleted in initial import', createdAt: '2026-10-18T11:00:00Z' },
    ];
    let triggers = 0;
    const context = vm.createContext({
      console: { log() {} },
      LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
      PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => properties.get(key), setProperty: (key: string, value: string) => properties.set(key, value) }) },
      UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ ok: true, rows }) }) },
      SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (name: string) => tables[name], insertSheet: (name: string) => (tables[name] = new FakeSheet()) }), CopyPasteType: { PASTE_FORMAT: 'format' } },
      ScriptApp: {
        getProjectTriggers: () => triggers ? [{ getHandlerFunction: () => 'syncSmartCarLeads' }] : [],
        newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => { triggers++; } }) }) }),
      },
      Utilities: { formatDate: () => '19/10/2026 19:00' },
    });
    vm.runInContext(readFileSync('scripts/leads-sheet/AppsScript.gs', 'utf8'), context);
    vm.runInContext('installLeadSync()', context);
    expect(sheet.rows).toHaveLength(3);
    expect(sheet.rows[2][1]).toBe('Manually edited');
    rows = [...rows, { key: 'booking:new', name: '=HYPERLINK("https://example.invalid")', createdAt: '2026-10-19T18:00:00Z' }];
    vm.runInContext('installLeadSync()', context);
    vm.runInContext('syncSmartCarLeads()', context);
    expect(triggers).toBe(1);
    expect(sheet.rows).toHaveLength(4);
    expect(sheet.rows[2][1]).toMatch(/^'=/);
    expect(sheet.rows[3][5]).toBe('Keep this note');
    sheet.rows.splice(2,1);
    vm.runInContext('syncSmartCarLeads()', context);
    expect(sheet.rows).toHaveLength(3);
    expect(sheet.note).toContain('19/10/2026');
    expect(sheet.rows[0][0]).toBe('My own title');
    sheet.insertRowsBefore(2,1);
    sheet.rows[1] = ['עודכן 19 באוק׳ 2026, 18:23 · 65 פניות'];
    vm.runInContext('syncSmartCarLeads()', context);
    expect(sheet.rows[1][0]).toBe('סנכרון אחרון: 19/10/2026 19:00 · 1 פניות · 0 צור קשר');
    expect(sheet.rows[3][5]).toBe('Keep this note');
  });
});
