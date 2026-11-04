'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { Download, Mail, MessageCircle, Phone, QrCode, RefreshCw, Search, Send, Settings, X } from 'lucide-react';
import { REPORT_BRANCHES, branchByKey } from '@/lib/accident-report/branches';
import { ROAD_LABELS, ZONE_LABELS, formatPlate, insurerName, type StoredReport } from '@/lib/accident-report/schema';

type Status = 'NEW' | 'IN_PROGRESS' | 'SENT_TO_INSURANCE' | 'CLOSED';
const STATUS: Record<Status, { label: string; cls: string }> = {
  NEW: { label: 'חדש', cls: 'bg-brand-600 text-white' },
  IN_PROGRESS: { label: 'בטיפול', cls: 'bg-amber-100 text-amber-800' },
  SENT_TO_INSURANCE: { label: 'הועבר לביטוח', cls: 'bg-sky-100 text-sky-800' },
  CLOSED: { label: 'סגור', cls: 'bg-gray-100 text-gray-600' },
};

interface ListRow {
  id: string;
  status: Status;
  car_plate: string;
  car_model: string | null;
  driver_name: string;
  driver_phone: string;
  accident_date: string | null;
  other_vehicle: boolean;
  branch: string | null;
  email_sent: boolean;
  created_at: string;
}

interface Detail extends ListRow {
  data: StoredReport;
  internal_notes: string | null;
  files: { photos: string[]; licensePhoto: string | null; docsPhoto: string | null; signature: string | null; pdf: string | null };
}

const appUrl = () => (typeof window !== 'undefined' ? window.location.origin : 'https://smartcar.co.il');

function heDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('he-IL');
}

function waNumber(phone: string) {
  const d = phone.replace(/\D/g, '');
  return d.startsWith('0') ? `972${d.slice(1)}` : d;
}

function KV({ k, v, ltr }: { k: string; v?: React.ReactNode; ltr?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{k}</span>
      <span className="text-[15px] font-medium break-words" dir={ltr ? 'ltr' : undefined} style={ltr ? { textAlign: 'right' } : undefined}>{v || '—'}</span>
    </div>
  );
}

export default function AccidentReportsAdminPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">טוען…</div>}>
      <AccidentReportsAdmin />
    </Suspense>
  );
}

function AccidentReportsAdmin() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'ALL'>('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [selected, setSelected] = useState<string | null>(searchParams.get('id'));
  const [detail, setDetail] = useState<Detail | null>(null);
  const [notes, setNotes] = useState('');
  const [modal, setModal] = useState<'send' | 'settings' | 'qr' | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/accident-reports');
      const json = await res.json();
      setRows(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/accident-reports')
      .then((res) => res.json())
      .then((json) => { if (!cancelled) setRows(json.data ?? []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    fetch(`/api/admin/accident-reports/${encodeURIComponent(selected)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) { setDetail(d); setNotes(d.internal_notes ?? ''); } });
    return () => { cancelled = true; };
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().replace(/-/g, '');
    return rows.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (branchFilter !== 'ALL' && r.branch !== branchFilter) return false;
      if (!q) return true;
      return [r.id, r.car_plate.replace(/-/g, ''), r.driver_name, r.driver_phone.replace(/-/g, '')].some((x) => x.includes(q));
    });
  }, [rows, query, statusFilter, branchFilter]);

  const patch = async (body: Record<string, unknown>) => {
    if (!detail) return;
    const res = await fetch(`/api/admin/accident-reports/${encodeURIComponent(detail.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { alert('שגיאה בשמירה'); return; }
    if (body.status) {
      setRows((p) => p.map((r) => (r.id === detail.id ? { ...r, status: body.status as Status } : r)));
      setDetail({ ...detail, status: body.status as Status });
    }
  };

  const counts = useMemo(() => ({
    NEW: rows.filter((r) => r.status === 'NEW').length,
    IN_PROGRESS: rows.filter((r) => r.status === 'IN_PROGRESS').length,
  }), [rows]);

  const shown = selected && detail?.id === selected ? detail : null;
  const r = shown?.data;

  return (
    <div className="p-4 md:p-8" dir="rtl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">דוחות תאונה</h1>
          <p className="text-sm text-gray-500">{counts.NEW} חדשים · {counts.IN_PROGRESS} בטיפול</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setModal('send')} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"><Send className="h-4 w-4" />שליחת טופס ללקוח</button>
          <button onClick={() => setModal('qr')} className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold"><QrCode className="h-4 w-4" />קודי QR לסניפים</button>
          <button onClick={() => setModal('settings')} className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold"><Settings className="h-4 w-4" />נמעני מייל</button>
          <button onClick={() => { setLoading(true); load(); }} aria-label="רענון" className="rounded-xl border border-gray-300 bg-white px-3 py-2.5"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        {/* List */}
        <div className="min-w-0 flex-[999_1_560px]">
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative flex-[1_1_240px]">
              <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש לפי מס' רכב, שם, טלפון או מס' דו&quot;ח"
                className="h-10 w-full rounded-xl border border-gray-300 bg-white pr-9 pl-3 text-sm" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Status | 'ALL')} className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm">
              <option value="ALL">כל הסטטוסים</option>
              {(Object.keys(STATUS) as Status[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
            </select>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm">
              <option value="ALL">כל הסניפים</option>
              {REPORT_BRANCHES.map((b) => <option key={b.key} value={b.key}>{b.nameHe}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead className="border-b border-gray-200 text-xs text-gray-500">
                <tr>{['מס\' דו"ח', 'נשלח', 'רכב', 'נהג', 'צד ג\'', 'סניף', 'סטטוס'].map((h) => <th key={h} className="px-3 py-3 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">טוען…</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">אין דוחות להצגה</td></tr>}
                {filtered.map((row) => (
                  <tr key={row.id} onClick={() => setSelected(row.id)}
                    className={`cursor-pointer border-b border-gray-100 last:border-0 hover:bg-brand-50 ${selected === row.id ? 'bg-brand-50' : ''} ${row.status === 'NEW' ? 'font-semibold' : ''}`}>
                    <td className="px-3 py-3" dir="ltr" style={{ textAlign: 'right' }}>{row.id}</td>
                    <td className="px-3 py-3">{heDate(row.created_at)}</td>
                    <td className="px-3 py-3" dir="ltr" style={{ textAlign: 'right' }}>{row.car_plate}</td>
                    <td className="px-3 py-3">{row.driver_name}</td>
                    <td className="px-3 py-3">{row.other_vehicle ? 'כן' : 'לא'}</td>
                    <td className="px-3 py-3">{branchByKey(row.branch)?.nameHe ?? '—'}</td>
                    <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[row.status].cls}`}>{STATUS[row.status].label}</span>{!row.email_sent && <span className="mr-1 text-xs text-red-600" title="המייל לא נשלח">✉︎!</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail */}
        {shown && r && (
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-gray-500">דו&quot;ח תאונה</div>
                <div className="text-xl font-bold" dir="ltr" style={{ textAlign: 'right' }}>{shown.id}</div>
              </div>
              <div className="flex items-center gap-2">
                <select value={shown.status} onChange={(e) => patch({ status: e.target.value })} className="h-10 rounded-lg border border-brand-600 bg-brand-50 px-2 text-sm font-semibold text-brand-600">
                  {(Object.keys(STATUS) as Status[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                </select>
                <button onClick={() => setSelected(null)} aria-label="סגירה" className="rounded-lg p-2 hover:bg-gray-100"><X className="h-4 w-4" /></button>
              </div>
            </div>
            {!shown.email_sent && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">המייל על הדו&quot;ח הזה לא נשלח. אפשר להוריד את ה־PDF ולהעביר ידנית.</div>}
            <div className="flex flex-wrap gap-2">
              {shown.files.pdf && <a href={shown.files.pdf} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg border border-brand-600 px-3 py-2 text-sm font-semibold text-brand-600"><Download className="h-4 w-4" />PDF</a>}
              {shown.files.pdf && <a href={`mailto:?subject=${encodeURIComponent(`דו"ח תאונה ${shown.id}`)}&body=${encodeURIComponent(`מצורף קישור לדו"ח התאונה (בתוקף לשעה):\n${shown.files.pdf}`)}`} className="flex items-center gap-1.5 rounded-lg border border-brand-600 px-3 py-2 text-sm font-semibold text-brand-600"><Mail className="h-4 w-4" />העברה במייל</a>}
              <a href={`https://wa.me/${waNumber(r.driver.phone)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg border border-brand-600 px-3 py-2 text-sm font-semibold text-brand-600"><MessageCircle className="h-4 w-4" />וואטסאפ לנהג</a>
              <a href={`tel:${r.driver.phone}`} className="flex items-center gap-1.5 rounded-lg border border-brand-600 px-3 py-2 text-sm font-semibold text-brand-600"><Phone className="h-4 w-4" />חיוג</a>
            </div>

            <section className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
              <KV k="רכב" v={`${formatPlate(r.car.plate)}`} ltr /><KV k="דגם" v={r.car.model} />
              <KV k="נהג" v={r.driver.name} /><KV k="ת.ז." v={r.driver.idNumber} ltr />
              <KV k="טלפון" v={r.driver.phone} ltr /><KV k="מייל" v={r.driver.email} ltr />
              <KV k="רישיון" v={r.driver.licenseNumber} ltr /><KV k="תוקף" v={`${r.driver.licenseExpiry.d}.${r.driver.licenseExpiry.m}.${r.driver.licenseExpiry.y}`} ltr />
              <div className="col-span-2"><KV k="כתובת" v={r.driver.address} /></div>
            </section>

            <section className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
              <KV k="מועד" v={`${heDate(r.accident.date)}, ${r.accident.time}`} /><KV k="סניף" v={branchByKey(r.branch)?.nameHe} />
              <div className="col-span-2"><KV k="מקום" v={
                r.accident.location.startsWith('GPS ')
                  ? <a className="underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${encodeURIComponent(r.accident.location.slice(4))}`}>{r.accident.location}</a>
                  : <>{r.accident.location} · <a className="underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/${encodeURIComponent(r.accident.location)}`}>מפה</a></>
              } /></div>
              <KV k="סוג דרך" v={ROAD_LABELS[r.accident.roadType].he} /><KV k="נפגעים / משטרה" v={`${r.accident.injured ? 'כן' : 'לא'} / ${r.accident.police ? 'כן' : 'לא'}`} />
              {r.accident.police && <><KV k="תחנה" v={r.accident.policeStation} /><KV k="מס' יומן" v={r.accident.policeReport} ltr /></>}
              <div className="col-span-2"><KV k="תיאור" v={r.accident.description} /></div>
            </section>

            <section className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
              {r.other.involved ? (
                <>
                  <KV k="צד ג' – רכב" v={formatPlate(r.other.plate)} ltr /><KV k="סוג ודגם" v={r.other.model} />
                  <KV k="ביטוח" v={insurerName(r.other)} /><KV k="פוליסה" v={r.other.policy} ltr />
                  <KV k="בעל הרכב" v={r.other.ownerName} /><KV k="ת.ז." v={r.other.ownerId} ltr />
                  <KV k="טלפון" v={r.other.ownerPhone} ltr /><KV k="סוכן" v={r.other.agent} />
                  <div className="col-span-2"><KV k="כתובת" v={r.other.ownerAddress} /></div>
                </>
              ) : <div className="col-span-2 text-sm text-gray-500">לא היה רכב נוסף מעורב.</div>}
            </section>

            <section className="flex flex-col gap-2 border-t border-gray-100 pt-4">
              <KV k="נזק לרכב שלנו" v={`${r.damage.zones.map((z) => ZONE_LABELS[z].he).join(', ')}${r.damage.zones.length ? ' · ' : ''}${r.damage.ours}`} />
              {r.other.involved && <KV k="נזק לרכב השני" v={r.damage.theirs} />}
            </section>

            <section className="border-t border-gray-100 pt-4">
              <div className="mb-2 text-xs text-gray-500">תמונות ומסמכים</div>
              <div className="grid grid-cols-4 gap-2">
                {[...shown.files.photos, shown.files.licensePhoto, shown.files.docsPhoto].filter(Boolean).map((u) => (
                  <a key={u!} href={u!} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u!} alt="" className="h-full w-full object-cover" />
                  </a>
                ))}
                {shown.files.signature && (
                  <div className="flex aspect-square items-center justify-center rounded-lg bg-gray-50 p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={shown.files.signature} alt="חתימה" className="max-h-full max-w-full" />
                  </div>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-1.5 border-t border-gray-100 pt-4">
              <label htmlFor="notes" className="text-sm font-semibold">הערה פנימית</label>
              <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (shown.internal_notes ?? '') && patch({ internal_notes: notes })}
                rows={3} placeholder="הערה לצוות (לא נשלחת ללקוח)" className="rounded-xl border border-gray-300 p-3 text-sm" />
            </section>
          </div>
        )}
      </div>

      {modal === 'send' && <SendLinkModal onClose={() => setModal(null)} />}
      {modal === 'settings' && <RecipientsModal onClose={() => setModal(null)} />}
      {modal === 'qr' && <QrModal onClose={() => setModal(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="סגירה" className="rounded-lg p-2 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SendLinkModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ phone: '', name: '', idNumber: '', plate: '', model: '', branch: '', lang: 'he' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const send = async () => {
    if (form.phone.replace(/\D/g, '').length < 9) { setErr('צריך מספר טלפון של הלקוח'); return; }
    setBusy(true); setErr('');
    const res = await fetch('/api/admin/accident-reports/links', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) { setErr('יצירת הקישור נכשלה'); return; }
    const { token } = await res.json();
    const link = `${appUrl()}/${form.lang}/accident-report?t=${token}${form.branch ? `&b=${form.branch}` : ''}`;
    const msg = form.lang === 'en'
      ? `Hi${form.name ? ` ${form.name}` : ''}, this is SmartCar. Please fill in the accident report here (about 3 minutes):\n${link}`
      : `שלום${form.name ? ` ${form.name}` : ''}, כאן סמארט קאר. כדי שנוכל לטפל בתאונה, נבקש למלא את דו"ח התאונה בקישור (כ־3 דקות):\n${link}`;
    window.open(`https://wa.me/${waNumber(form.phone)}?text=${encodeURIComponent(msg)}`, '_blank');
    onClose();
  };

  const inp = 'h-11 w-full rounded-xl border border-gray-300 px-3 text-sm';
  return (
    <ModalShell title="שליחת טופס תאונה ללקוח" onClose={onClose}>
      <p className="mb-4 text-sm text-gray-500">ייפתח וואטסאפ עם הודעה מוכנה וקישור אישי ללקוח. הקישור בתוקף 7 ימים, והפרטים שתמלאו כאן יופיעו בטופס ממולאים מראש.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 text-sm font-semibold">טלפון הלקוח<input dir="ltr" inputMode="tel" className={inp} value={form.phone} onChange={set('phone')} /></label>
        <label className="text-sm font-semibold">שם הלקוח<input className={inp} value={form.name} onChange={set('name')} /></label>
        <label className="text-sm font-semibold">ת.ז. <span className="font-normal text-gray-400">(לא חובה)</span><input dir="ltr" inputMode="numeric" className={inp} value={form.idNumber} onChange={set('idNumber')} /></label>
        <label className="text-sm font-semibold">מספר רכב<input dir="ltr" inputMode="numeric" className={inp} value={form.plate} onChange={set('plate')} /></label>
        <label className="text-sm font-semibold">דגם<input className={inp} value={form.model} onChange={set('model')} /></label>
        <label className="text-sm font-semibold">סניף<select className={inp} value={form.branch} onChange={set('branch')}><option value="">—</option>{REPORT_BRANCHES.map((b) => <option key={b.key} value={b.key}>{b.nameHe}</option>)}</select></label>
        <label className="text-sm font-semibold">שפת הטופס<select className={inp} value={form.lang} onChange={set('lang')}><option value="he">עברית</option><option value="en">English</option></select></label>
      </div>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      <button onClick={send} disabled={busy} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-60"><MessageCircle className="h-5 w-5" />{busy ? 'יוצרים קישור…' : 'פתיחת וואטסאפ'}</button>
    </ModalShell>
  );
}

function RecipientsModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<string[]>([]);
  const [add, setAdd] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { fetch('/api/admin/accident-reports/settings').then((r) => r.json()).then((d) => setList(d.recipients ?? [])); }, []);
  const save = async (next: string[]) => {
    const res = await fetch('/api/admin/accident-reports/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipients: next }) });
    if (!res.ok) { setMsg('שמירה נכשלה. צריך לפחות כתובת אחת תקינה.'); return; }
    const d = await res.json(); setList(d.recipients); setMsg('נשמר');
  };
  return (
    <ModalShell title="נמעני מייל לדוחות תאונה" onClose={onClose}>
      <p className="mb-3 text-sm text-gray-500">כל דו&quot;ח חדש יישלח לכתובות האלה, עם ה־PDF מצורף.</p>
      <ul className="mb-3 flex flex-col gap-2">
        {list.map((e) => (
          <li key={e} className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-sm" dir="ltr">
            {e}
            <button onClick={() => save(list.filter((x) => x !== e))} disabled={list.length === 1} className="text-red-600 disabled:opacity-30" aria-label={`הסרת ${e}`}><X className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input dir="ltr" type="email" value={add} onChange={(e) => setAdd(e.target.value)} placeholder="name@smartcar.co.il" className="h-11 flex-1 rounded-xl border border-gray-300 px-3 text-sm" />
        <button onClick={() => { if (add.trim()) { save([...list, add.trim()]); setAdd(''); } }} className="rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white">הוספה</button>
      </div>
      {msg && <p className="mt-3 text-sm text-gray-600">{msg}</p>}
    </ModalShell>
  );
}

function QrModal({ onClose }: { onClose: () => void }) {
  const [codes, setCodes] = useState<{ key: string; name: string; url: string; img: string }[]>([]);
  useEffect(() => {
    Promise.all(
      REPORT_BRANCHES.map(async (b) => {
        const url = `${appUrl()}/he/accident-report?b=${b.key}`;
        const img = await QRCode.toDataURL(url, { width: 600, margin: 1, color: { dark: '#14282A', light: '#FFFFFF' } });
        return { key: b.key, name: b.nameHe, url, img };
      }),
    ).then(setCodes);
  }, []);
  return (
    <ModalShell title="קודי QR לסניפים" onClose={onClose}>
      <p className="mb-4 text-sm text-gray-500">כל קוד מוביל לטופס, ובממשק יופיע מאיזה סניף הגיע הדו&quot;ח. אפשר להוריד ולהדפיס.</p>
      <div className="grid grid-cols-2 gap-4">
        {codes.map((c) => (
          <div key={c.key} className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.img} alt={`QR סניף ${c.name}`} className="w-full" />
            <div className="text-sm font-semibold">סניף {c.name}</div>
            <a href={c.img} download={`smartcar-accident-qr-${c.key}.png`} className="text-sm font-semibold text-brand-600 underline">הורדה</a>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}
