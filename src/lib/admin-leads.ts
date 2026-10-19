import { z } from "zod";
import type { LeadExportRow } from "@/lib/lead-export";

export const CONTACT_STATES = {
  NEW: "חדשה",
  CONTACTED: "נוצר קשר",
  QUOTED: "נשלחה הצעה",
  WON: "נסגרה עסקה",
  CLOSED: "נסגרה ללא עסקה",
} as const;
export interface ContactFollowup {
  status: keyof typeof CONTACT_STATES;
  assignee: string;
  follow_up_at: string | null;
  internal_note: string;
  version: number;
}
export interface AdminLead extends LeadExportRow {
  followup: ContactFollowup | null;
}
export const DEFAULT_FOLLOWUP: ContactFollowup = {
  status: "NEW",
  assignee: "",
  follow_up_at: null,
  internal_note: "",
  version: 0,
};
export const followupSchema = z
  .object({
    status: z.enum(["NEW", "CONTACTED", "QUOTED", "WON", "CLOSED"]),
    assignee: z.string().trim().max(100),
    follow_up_at: z.string().datetime({ offset: true }).nullable(),
    internal_note: z.string().max(5000),
    version: z.number().int().min(0).max(2_000_000_000),
  })
  .strict();

export function followupDue(lead: AdminLead, now = Date.now()) {
  const f = lead.followup;
  return (
    !!f &&
    !["WON", "CLOSED"].includes(f.status) &&
    !!f.follow_up_at &&
    Date.parse(f.follow_up_at) <= now
  );
}

/** datetime-local fields always describe Israel time, regardless of phone timezone. */
export function israelDateTimeInput(iso: string | null): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function israelInputToIso(input: string): string | null {
  if (!input) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input))
    throw new Error("Invalid date");
  const naive = Date.parse(input + ":00Z");
  if (!Number.isFinite(naive)) throw new Error("Invalid date");
  let instant = naive;
  for (let step = 0; step < 3; step++) {
    const local = israelDateTimeInput(new Date(instant).toISOString());
    instant += naive - Date.parse(local + ":00Z");
  }
  const iso = new Date(instant).toISOString();
  if (israelDateTimeInput(iso) !== input)
    throw new Error("Invalid Israel time");
  return iso;
}
