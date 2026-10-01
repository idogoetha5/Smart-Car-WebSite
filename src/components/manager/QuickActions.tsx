'use client';

import { useState } from 'react';
import { ChevronLeft, Clock3, Droplets, Plus, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Sheet from '@/components/ui/Sheet';
import { useManager, type NewTaskOptions } from './ManagerData';

interface Action {
  key: string;
  title: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
  opts: NewTaskOptions;
}

/** The three quick ways to send work, next to "משימה חדשה" (מסירה / החזרה). */
export const QUICK_ACTIONS: Action[] = [
  { key: 'today', title: 'משימה להיום', hint: 'עכשיו או בשעות הקרובות', icon: Clock3, tone: 'bg-[#eef6f6] text-[#2D5F5F]', opts: { today: true } },
  { key: 'wash', title: 'שטיפה', hint: 'בוחרים רכב ונהג, וזה נשלח', icon: Droplets, tone: 'bg-sky-50 text-sky-600', opts: { type: 'wash' } },
  { key: 'service', title: 'טיפול ברכב', hint: "מוסך, פנצ'רייה או טסט", icon: Wrench, tone: 'bg-indigo-50 text-[#5B5BD6]', opts: { type: 'service' } },
];

function ActionRow({ a, onPick }: { a: Action; onPick: () => void }) {
  const Icon = a.icon;
  return (
    <button
      type="button"
      onClick={onPick}
      className="group flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3.5 py-3 text-start shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#2D5F5F]/25 hover:shadow-md active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2D5F5F]/15"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${a.tone}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-black text-[#0D2B2B]">{a.title}</span>
        <span className="block truncate text-xs font-bold text-gray-500">{a.hint}</span>
      </span>
      <ChevronLeft className="h-5 w-5 shrink-0 text-gray-300 transition group-hover:-translate-x-0.5 group-hover:text-[#2D5F5F]" aria-hidden="true" />
    </button>
  );
}

/** Computer: "משימה חדשה" and, under it, a box with משימה להיום / שטיפה / טיפול ברכב. */
export function SidebarActions() {
  const { openNewTask } = useManager();
  return (
    <div className="mb-5">
      <button
        onClick={() => openNewTask()}
        className="mb-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#E8743B] text-sm font-black text-white shadow-sm transition hover:bg-[#d4632a]"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
        משימה חדשה
      </button>
      <p className="mb-2 px-1 text-xs font-bold text-slate-400">פעולות מהירות</p>
      <div className="grid gap-2">
        {QUICK_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => openNewTask(a.opts)}
              className="group flex min-h-14 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-start text-sm font-black text-[#0D2B2B] shadow-sm transition hover:border-[#2D5F5F]/30 hover:bg-[#f6fbfb] hover:shadow-md"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${a.tone}`}>
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className="flex-1">{a.title}</span>
              <ChevronLeft className="h-4 w-4 text-slate-300 transition group-hover:-translate-x-0.5 group-hover:text-[#2D5F5F]" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Phone: one floating "+" that opens a short menu of what to send. */
export function PhoneActions() {
  const { openNewTask } = useManager();
  const [open, setOpen] = useState(false);
  const pick = (opts?: NewTaskOptions) => {
    setOpen(false);
    openNewTask(opts);
  };
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 z-30 flex h-14 items-center gap-2 rounded-full bg-[#E8743B] px-5 text-base font-black text-white shadow-lg shadow-orange-300/50 transition active:scale-95 lg:hidden"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
        <span>משימה חדשה</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="מה לשלוח?">
        <div className="space-y-2">
          <ActionRow
            a={{ key: 'new', title: 'משימה חדשה', hint: 'מסירה או החזרה, לכל תאריך', icon: Plus, tone: 'bg-orange-50 text-[#E8743B]', opts: {} }}
            onPick={() => pick()}
          />
          {QUICK_ACTIONS.map((a) => (
            <ActionRow key={a.key} a={a} onPick={() => pick(a.opts)} />
          ))}
        </div>
      </Sheet>
    </>
  );
}
