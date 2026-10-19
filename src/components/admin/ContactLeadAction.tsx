"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useApiList } from "@/lib/swr";
import { isNewContactLead, type AdminLead } from "@/lib/admin-leads";

/** Same private feed and NEW definition as the lead inbox; no write on opening. */
export default function ContactLeadAction({ locale }: { locale: string }) {
  const { items, error, isLoading } = useApiList<AdminLead>(
    "/api/admin/leads",
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
    },
  );
  const count = items.filter(isNewContactLead).length;
  const he = locale === "he";
  const ready = !error && !isLoading;
  return (
    <Link
      href={`/${locale}/admin/leads?source=contact${ready && count > 0 ? "&status=NEW" : ""}`}
      className="order-first col-span-2 flex min-h-28 min-w-0 flex-col rounded-2xl border border-[#B8D8D8] bg-[#EAF4F4] px-4 py-3 text-sm text-[#0D2B2B] transition hover:bg-[#DCEDED] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D5F5F] sm:order-none sm:col-span-1"
    >
      <span className="flex items-center justify-between gap-2 font-black">
        {he ? "פניות צור קשר" : "Contact enquiries"}
        {ready && count > 0 && (
          <span className="rounded-full bg-[#2D5F5F] px-2.5 py-0.5 text-white">
            {count}
          </span>
        )}
      </span>
      <span
        className="mt-2 text-xs font-semibold leading-5 text-[#2D5F5F]"
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
      <span className="mt-3 flex items-center justify-between gap-2 font-black">
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
