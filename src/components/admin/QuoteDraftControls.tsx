"use client";

import { useState } from "react";
import AdminSheet from "@/components/admin/AdminSheet";

export default function QuoteDraftControls({
  onDiscard,
  storageError,
  english = false,
}: {
  onDiscard: () => void;
  storageError: boolean;
  english?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#D5E5DF] bg-[#EDF5F1] p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p
          role={storageError ? "status" : undefined}
          className={
            storageError
              ? "font-bold text-amber-800"
              : "font-medium leading-6 text-[#345E52]"
          }
        >
          {storageError
            ? english
              ? "Draft saving is unavailable on this device. Keep this page open."
              : "לא ניתן לשמור טיוטה במכשיר הזה. מומלץ להשאיר את הדף פתוח."
            : english
              ? "Draft is saved on this device and can be restored for 7 days."
              : "הטיוטה נשמרת במכשיר הזה וזמינה לשחזור במשך 7 ימים."}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-11 shrink-0 rounded-xl border border-[#B8D8D8] bg-white px-4 font-bold text-[#2D5F5F] shadow-sm transition hover:bg-[#F9FCFA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D5F5F]"
        >
          {english ? "New quotation" : "הצעה חדשה"}
        </button>
      </div>
      <AdminSheet
        open={open}
        onClose={() => setOpen(false)}
        title={english ? "Start a new quotation?" : "להתחיל הצעה חדשה?"}
        alert
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-12 flex-1 rounded-xl border border-slate-200 font-bold"
            >
              {english ? "Keep editing" : "להמשיך לערוך"}
            </button>
            <button
              type="button"
              onClick={() => {
                onDiscard();
                window.location.reload();
              }}
              className="min-h-12 flex-1 rounded-xl bg-[#2D5F5F] font-bold text-white"
            >
              {english ? "New quotation" : "הצעה חדשה"}
            </button>
          </div>
        }
      >
        <p className="text-base leading-7 text-slate-700">
          {english
            ? "The draft on this device will be cleared. Already generated or sent documents will not be deleted."
            : "הטיוטה שבמכשיר תימחק ותיפתח הצעה חדשה. מסמכים שכבר הופקו או נשלחו לא יימחקו."}
        </p>
      </AdminSheet>
    </>
  );
}
