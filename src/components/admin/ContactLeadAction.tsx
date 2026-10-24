"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useApiList } from "@/lib/swr";
import { ADMIN_LEADS_REFRESH, isNewContactLead, type AdminLead } from "@/lib/admin-leads";

/** Same private feed and NEW definition as the lead inbox; no write on opening. */
export default function ContactLeadAction({ locale }: { locale: string }) {
  const { items, error, isLoading } = useApiList<AdminLead>(
    "/api/admin/leads",
    ADMIN_LEADS_REFRESH,
  );
  const count = items.filter(isNewContactLead).length;
  const he = locale === "he";
  const ready = !error && !isLoading;
  return (
    <Link
      href={`/${locale}/admin/leads?source=contact${ready && count > 0 ? "&status=NEW" : ""}`}
      className="order-first col-span-2 flex min-h-28 min-w-0 flex-col rounded-3xl border border-[#345E58] bg-[linear-gradient(135deg,#255B55,#0D2B2B)] p-4 text-sm text-white shadow-[0_12px_28px_rgba(13,43,43,0.16)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D5F5F] sm:order-none sm:col-span-1"
    >
      <span className="flex items-center justify-between gap-2 font-black">
        {he ? "פניות צור קשר" : "Contact enquiries"}
        {ready && count > 0 && (
          <span className="rounded-full border border-white/20 bg-white/15 px-2.5 py-0.5 text-white">
            {count}
          </span>
        )}
      </span>
      <span
        className="mt-2 text-sm font-medium leading-6 text-[#D5EAE4]"
        aria-live="polite"
      >
        {error
          ? he
            ? "הספירה אינה זמינה כרגע"
            : "Count temporarily unavailable"
          : isLoading
            ? he
              ? "בודק פניות…"
              : "Checking enquiries…"
            : count > 0
              ? he
                ? `${count === 1 ? "פנייה חדשה ממתינה" : `${count} פניות חדשות ממתינות`} לטיפול`
                : `${count} new ${count === 1 ? "enquiry" : "enquiries"} to handle`
              : he
                ? "אין פניות חדשות שממתינות לטיפול"
                : "No new enquiries waiting"}
      </span>
      <span className="mt-4 flex min-h-11 items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 font-black text-[#16443E]">
        {ready && count > 0
          ? he
            ? "לטיפול בפניות"
            : "Handle enquiries"
          : he
            ? "כל פניות צור קשר"
            : "View contact enquiries"}
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4 shrink-0 rtl:rotate-0 ltr:rotate-180"
        />
      </span>
    </Link>
  );
}
