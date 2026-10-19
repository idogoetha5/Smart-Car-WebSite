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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p
          role={storageError ? "status" : undefined}
          className={
            storageError ? "font-bold text-amber-800" : "text-slate-500"
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
          className="min-h-11 rounded-xl border border-[#B8D8D8] bg-white px-3 font-bold text-[#2D5F5F]"
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
