"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Clock3,
  MessageCircle,
  Search,
  Table2,
} from "lucide-react";
import AdminSheet from "@/components/admin/AdminSheet";
import { useToast } from "@/components/ui/AppToast";
import { useApiList } from "@/lib/swr";
import {
  CONTACT_STATES,
  followupDue,
  israelDateTimeInput,
  israelInputToIso,
  isNewContactLead,
  leadInboxView,
  type AdminLead,
  type ContactFollowup,
} from "@/lib/admin-leads";

function date(iso: string) {
  return Number.isFinite(Date.parse(iso))
    ? new Date(iso).toLocaleString("he-IL", {
        timeZone: "Asia/Jerusalem",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "לא צוין";
}
function whatsapp(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  return `https://wa.me/${digits.startsWith("0") ? "972" + digits.slice(1) : digits}`;
}

function LeadPanel({
  lead,
  locale,
  onClose,
  onSaved,
}: {
  lead: AdminLead;
  locale: string;
  onClose: () => void;
  onSaved: (followup: ContactFollowup) => void;
}) {
  const [baseline, setBaseline] = useState(lead.followup);
  const [status, setStatus] = useState(lead.followup?.status ?? "NEW");
  const [assignee, setAssignee] = useState(lead.followup?.assignee ?? "");
  const [reminder, setReminder] = useState(
    israelDateTimeInput(lead.followup?.follow_up_at ?? null),
  );
  const [note, setNote] = useState(lead.followup?.internal_note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const saving = useRef(false);
  const toast = useToast();
  const contact = lead.key.startsWith("contact:") && !!baseline;
  const dirty =
    contact &&
    (status !== baseline?.status ||
      assignee !== baseline?.assignee ||
      reminder !== israelDateTimeInput(baseline?.follow_up_at ?? null) ||
      note !== baseline?.internal_note);
  const close = () => {
    if (dirty) setDiscardOpen(true);
    else onClose();
  };
  const save = async () => {
    if (!contact || !baseline || saving.current) return;
    let instant: string | null;
    try {
      instant = israelInputToIso(reminder);
    } catch {
      setError("מועד החזרה אינו תקין לפי שעון ישראל. בחרו מועד אחר.");
      return;
    }
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/contact-leads/${encodeURIComponent(lead.key.slice(8))}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            assignee,
            follow_up_at: instant,
            internal_note: note,
            version: baseline.version,
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.data) {
        setError(body.error || "פרטי הטיפול לא נשמרו. נסו שוב.");
        return;
      }
      setBaseline(body.data);
      setAssignee(body.data.assignee);
      onSaved(body.data);
      toast("פרטי הטיפול נשמרו");
    } catch {
      setError("לא ניתן לשמור עקב בעיית חיבור. הטקסט שהקלדת נשאר כאן.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const wa = whatsapp(lead.phone);
  return (
    <>
      <AdminSheet
        open
        onClose={close}
        busy={busy}
        title={lead.name || "פרטי פנייה"}
        description={`${lead.source} · ${date(lead.createdAt)}`}
        footer={
          <div className="space-y-2">
            {contact && (
              <button
                type="button"
                onClick={save}
                disabled={busy || !dirty}
                className="min-h-14 w-full rounded-xl bg-[#2D5F5F] font-black text-white disabled:opacity-40"
              >
                {busy ? "שומר…" : "שמירת פרטי טיפול"}
              </button>
            )}
            <div className="flex gap-2">
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[#128C4A] font-bold text-white"
                >
                  WhatsApp
                </a>
              )}
              {lead.phone && (
                <a
                  href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`}
                  className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-[#B8D8D8] bg-[#EAF4F4] font-bold text-[#1F5A56]"
                >
                  התקשרות
                </a>
              )}
            </div>
          </div>
        }
      >
        <dl className="space-y-3">
          <div>
            <dt className="text-sm text-slate-500">טלפון</dt>
            <dd dir="ltr" className="mt-1 break-words text-end font-bold">
              {lead.phone || "לא צוין"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">אימייל</dt>
            <dd dir="ltr" className="mt-1 break-all text-end font-bold">
              {lead.email || "לא צוין"}
            </dd>
          </div>
        </dl>
        {lead.details && (
          <section className="mt-5">
            <h3 className="text-sm font-black text-[#2D5F5F]">תוכן הפנייה</h3>
            <p
              dir="auto"
              className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-base leading-7"
            >
              {lead.details}
            </p>
          </section>
        )}
        {lead.key.startsWith("booking:") && (
          <Link
            href={`/${locale}/admin/bookings?booking=${encodeURIComponent(lead.key.slice(8))}`}
            className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-[#EAF4F4] font-bold text-[#1F5A56]"
          >
            פתיחת ההזמנה המלאה
          </Link>
        )}
        {contact && (
          <section className="mt-6 space-y-4 border-t border-[#D9E8E2] pt-5">
            <h3 className="flex items-center gap-2 font-black text-[#16443E]">
              <MessageCircle aria-hidden="true" className="h-5 w-5" />
              טיפול בפניית צור קשר
            </h3>
            <label className="block text-sm font-bold text-slate-700">
              מצב הפנייה
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as ContactFollowup["status"])
                }
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base"
              >
                {Object.entries(CONTACT_STATES).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-700">
              אחראי לטיפול
              <input
                value={assignee}
                maxLength={100}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="למשל: דניאל"
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-3 text-base"
              />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              מועד חזרה ללקוח — שעון ישראל
              <input
                type="datetime-local"
                value={reminder}
                onChange={(e) => setReminder(e.target.value)}
                className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-slate-200 px-3 text-base"
              />
            </label>
            <p className="text-xs leading-5 text-slate-500">
              במועד שנבחר הפנייה תופיע ברשימת ״לחזור ללקוח״ בממשק. לא נשלחת
              הודעה אוטומטית ללקוח.
            </p>
            <label className="block text-sm font-bold text-slate-700">
              הערה פנימית
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={5000}
                rows={4}
                className="mt-2 w-full min-w-0 resize-y rounded-xl border border-slate-200 p-3 text-base"
              />
            </label>
            <p className="text-xs text-slate-500">
              פרטי הטיפול פנימיים בלבד ואינם נשלחים לגיליון או ללקוח.
            </p>
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm font-bold leading-6 text-red-800"
              >
                {error}
              </p>
            )}
          </section>
        )}
      </AdminSheet>
      <AdminSheet
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="לצאת בלי לשמור?"
        alert
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDiscardOpen(false)}
              className="min-h-12 rounded-xl border border-slate-200 font-bold"
            >
              להמשיך לערוך
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 rounded-xl bg-red-700 font-bold text-white"
            >
              יציאה ללא שמירה
            </button>
          </div>
        }
      >
        <p className="leading-7">השינויים בפרטי הטיפול עדיין לא נשמרו.</p>
      </AdminSheet>
    </>
  );
}

export default function AdminLeadsPage() {
  return (
    <Suspense
      fallback={<p className="p-8 text-center text-slate-500">טוען פניות…</p>}
    >
      <LeadsFromSearch />
    </Suspense>
  );
}

function LeadsFromSearch() {
  const search = useSearchParams();
  const view = leadInboxView(search);
  return (
    <LeadWorkspace
      key={`${view.source}:${view.newOnly}`}
      initialSource={view.source}
      initialNewOnly={view.newOnly}
    />
  );
}

function LeadWorkspace({
  initialSource,
  initialNewOnly,
}: {
  initialSource: string;
  initialNewOnly: boolean;
}) {
  const { locale = "he" } = useParams<{ locale: string }>();
  const { items, isLoading, error, mutate } = useApiList<AdminLead>(
    "/api/admin/leads",
    { refreshInterval: 30_000, revalidateOnFocus: true },
  );
  const [query, setQuery] = useState("");
  const [source, setSource] = useState(initialSource);
  const [newOnly, setNewOnly] = useState(initialNewOnly);
  const [dueOnly, setDueOnly] = useState(false);
  const [selected, setSelected] = useState<AdminLead | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", tick);
    };
  }, []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return items.filter(
      (lead) =>
        (!source || lead.source === source) &&
        (!newOnly || isNewContactLead(lead)) &&
        (!dueOnly || followupDue(lead, now)) &&
        (!q ||
          `${lead.name} ${lead.email} ${lead.details}`
            .toLowerCase()
            .includes(q) ||
          (digits.length >= 4 &&
            lead.phone.replace(/\D/g, "").includes(digits))),
    );
  }, [items, query, source, dueOnly, newOnly, now]);
  const due = items.filter((lead) => followupDue(lead, now)).length;
  return (
    <main dir="rtl" className="mx-auto max-w-6xl p-4 sm:p-8">
      <header className="mb-6 flex flex-col gap-5 rounded-3xl border border-[#345E58] bg-[linear-gradient(135deg,#255B55,#0D2B2B)] p-5 text-white shadow-[0_16px_36px_rgba(13,43,43,0.14)] sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-bold tracking-wide text-[#C5DDD6]">
            SMARTCAR · קשרי לקוחות
          </p>
          <h1 className="text-3xl font-black tracking-tight">פניות ולידים</h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-[#D5EAE4]">
            כל הפניות במקום אחד. טיפול ומעקב אישי בפניות צור קשר.
          </p>
        </div>
        <a
          href="https://docs.google.com/spreadsheets/d/1Ve0QjN471GdNno0mxfRkHmigozjRoBdoOr84PFNZH04/edit"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20"
        >
          <Table2 className="h-4 w-4" />
          פתיחת הגיליון
        </a>
      </header>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="relative">
          <span className="sr-only">
            חיפוש לפי שם, טלפון, אימייל או תוכן הפנייה
          </span>
          <Search className="pointer-events-none absolute end-3 top-4 h-5 w-5 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="שם, טלפון, אימייל או תוכן…"
            className="min-h-12 w-full rounded-2xl border border-[#D5E5DF] bg-white pe-11 ps-4 text-base shadow-sm outline-none transition focus:border-[#2D5F5F] focus:ring-4 focus:ring-[#2D5F5F]/10"
          />
        </label>
        <label>
          <span className="sr-only">מקור הפנייה</span>
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setDueOnly(false);
              if (e.target.value !== "צור קשר") setNewOnly(false);
            }}
            className="min-h-12 w-full rounded-2xl border border-[#D5E5DF] bg-white px-3 text-base shadow-sm outline-none focus:border-[#2D5F5F] focus:ring-4 focus:ring-[#2D5F5F]/10"
          >
            <option value="">כל המקורות</option>
            {["צור קשר", "השכרה", "ליסינג", "וואטסאפ"].map((label) => (
              <option key={label}>{label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={newOnly}
          onClick={() => {
            setNewOnly(!newOnly);
            setDueOnly(false);
            setSource("צור קשר");
          }}
          className={`flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold ${newOnly ? "border-[#2D5F5F] bg-[#2D5F5F] text-white" : "border-[#B8D8D8] bg-[#EAF4F4] text-[#1F5A56]"}`}
        >
          חדשות לטיפול · {items.filter(isNewContactLead).length}
        </button>
        <button
          type="button"
          aria-pressed={dueOnly}
          onClick={() => {
            setDueOnly(!dueOnly);
            setNewOnly(false);
            setSource(dueOnly ? "" : "צור קשר");
          }}
          className={`flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold ${dueOnly ? "border-[#2D5F5F] bg-[#2D5F5F] text-white" : "border-amber-200 bg-amber-50 text-amber-900"}`}
        >
          <Clock3 className="h-4 w-4" />
          לחזור ללקוח · {due}
        </button>
      </div>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800"
        >
          לא ניתן לעדכן את הפניות כרגע.{" "}
          {items.length ? "הנתונים האחרונים נשארו מוצגים." : ""}
          <button
            type="button"
            onClick={() => mutate()}
            className="ms-2 min-h-11 underline"
          >
            ניסיון נוסף
          </button>
        </div>
      )}
      {isLoading ? (
        <p className="py-10 text-center text-slate-500">טוען פניות…</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">{filtered.length} פניות</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((lead) => (
              <button
                type="button"
                key={lead.key}
                onClick={() => setSelected(lead)}
                className="group min-h-14 min-w-0 rounded-3xl border border-[#D9E8E2] border-s-4 border-s-[#2D5F5F] bg-white p-5 text-start shadow-[0_6px_20px_rgba(13,43,43,0.045)] transition hover:border-[#8BB8A9] hover:shadow-[0_10px_28px_rgba(13,43,43,0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D5F5F]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 break-words text-lg font-black text-[#0D2B2B]">
                    {lead.name}
                  </h2>
                  <span className="shrink-0 rounded-lg border border-[#D9E8E2] bg-[#EDF5F1] px-2.5 py-1 text-xs font-bold text-[#1F5A56]">
                    {lead.source}
                  </span>
                </div>
                <p
                  dir="ltr"
                  className="mt-3 break-all text-end text-sm font-bold text-[#2D5F5F]"
                >
                  {lead.phone || lead.email || "פרטי קשר לא צוינו"}
                </p>
                {lead.details && (
                  <p
                    dir="auto"
                    className="mt-3 line-clamp-2 break-words text-base leading-7 text-[#526862] [overflow-wrap:anywhere]"
                  >
                    {lead.details}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#E9F0EC] pt-3 text-xs text-[#637A76]">
                  <span>{date(lead.createdAt)}</span>
                  {lead.followup && (
                    <span className="font-bold text-[#2D5F5F]">
                      {CONTACT_STATES[lead.followup.status]}
                      {lead.followup.assignee
                        ? ` · ${lead.followup.assignee}`
                        : ""}
                    </span>
                  )}
                  {followupDue(lead, now) && (
                    <span className="font-bold text-amber-800">
                      הגיע מועד החזרה
                    </span>
                  )}
                  <ChevronLeft
                    aria-hidden="true"
                    className="ms-auto h-7 w-7 rounded-lg bg-[#EAF4EE] p-1 text-[#2D5F5F] transition group-hover:bg-[#DCECE3]"
                  />
                </div>
              </button>
            ))}
          </div>
          {!filtered.length && (
            <p className="rounded-2xl bg-white p-8 text-center text-slate-500">
              {error
                ? "רשימת הפניות אינה זמינה כרגע"
                : "אין פניות לתצוגה בסינון שנבחר"}
            </p>
          )}
        </>
      )}
      {selected && (
        <LeadPanel
          key={selected.key}
          lead={selected}
          locale={locale}
          onClose={() => setSelected(null)}
          onSaved={(followup) => {
            void mutate(
              (current) =>
                (current ?? []).map((lead) =>
                  lead.key === selected.key ? { ...lead, followup } : lead,
                ),
              { revalidate: false },
            );
          }}
        />
      )}
    </main>
  );
}
