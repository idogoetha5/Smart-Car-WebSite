'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { DayPicker } from 'react-day-picker';
import { he as heLocale, enUS } from 'date-fns/locale';
import 'react-day-picker/style.css';

function toDate(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toYMD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export interface DatePickerHandle {
  openPicker: () => void;
}

interface DatePickerInputProps {
  value: string;
  onChange: (v: string) => void;
  minDate?: string;
  placeholder: string;
  /** What this date is for. Required: see the aria-label below. */
  fieldLabel: string;
  isHe?: boolean;
  className?: string;
}

const DatePickerInput = forwardRef<DatePickerHandle, DatePickerInputProps>(function DatePickerInput(
  { value, onChange, minDate, placeholder, fieldLabel, isHe = true, className = '' },
  ref
) {
  const [open, setOpen] = useState(false);
  const [calPos, setCalPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const calRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = toDate(value);
  const minD = (minDate ? toDate(minDate) : undefined) ?? today;

  const openCal = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const calW = 300;
    let left = r.left;
    if (left + calW > window.innerWidth - 8) left = Math.max(8, r.right - calW);
    if (left < 8) left = 8;
    setCalPos({ top: r.bottom + 6, left });
    setOpen(true);
  };

  useImperativeHandle(ref, () => ({ openPicker: openCal }));

  /**
   * Always route closing through here. Escape already restored focus, but
   * picking a day or clicking away left focus on <body>, so a keyboard user
   * was dumped at the top of the document and had to tab back through the
   * whole form.
   */
  const closeCal = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) btnRef.current?.focus();
  };


  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || calRef.current?.contains(t)) return;
      // Pointer dismissal: don't yank focus back, the user is already elsewhere.
      closeCal(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCal();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = false;
    const timer = setTimeout(() => { active = true; }, 200);
    const onScroll = () => { if (active) closeCal(false); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [open]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    onChange(toYMD(date));
    closeCal();
  };

  const display = selected
    ? selected.toLocaleDateString(isHe ? 'he-IL' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openCal}
        aria-haspopup="dialog"
        aria-expanded={open}
        // The button's text is the chosen date and nothing else, so once a
        // customer had picked both, a screen reader announced two controls
        // called "1 Sep 2026" and "3 Sep 2026" with no way to tell pickup
        // from return. The visible label sits in a sibling <p> or <label>
        // that is not associated with the button and cannot be — a <label>
        // does not label a <button>. Naming it here is the fix.
        aria-label={display ? `${fieldLabel}: ${display}` : fieldLabel}
        className={`text-start bg-transparent outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5F5F] focus-visible:ring-offset-1 rounded ${className}`}
      >
        {display ? (
          <span className="text-sm text-gray-800 font-medium">{display}</span>
        ) : (
          <span className="text-sm text-gray-600">{placeholder}</span>
        )}
      </button>

      {open && (
        <div
          ref={calRef}
          role="dialog"
          // Was "false", which tells assistive tech the rest of the page is
          // still live while a popup covers it.
          aria-modal="true"
          aria-label={isHe ? 'בחירת תאריך' : 'Choose a date'}
          className="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-gray-200 p-1"
          style={{ top: calPos.top, left: calPos.left }}
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            disabled={{ before: minD }}
            defaultMonth={selected ?? minD}
            dir={isHe ? 'rtl' : 'ltr'}
            // Moves focus into the grid on open. Without it focus stayed on
            // the trigger and arrow keys did nothing.
            autoFocus
            // Day names, month names and the nav buttons were announced in
            // English on a Hebrew, RTL page ("Wednesday, July 1st",
            // "Go to the Next Month").
            locale={isHe ? heLocale : enUS}
            labels={
              isHe
                ? {
                    labelNext: () => 'לחודש הבא',
                    labelPrevious: () => 'לחודש הקודם',
                    labelGrid: (date) =>
                      date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }),
                    labelDayButton: (date, modifiers) =>
                      `${date.toLocaleDateString('he-IL', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                      })}${modifiers?.selected ? ', נבחר' : ''}`,
                  }
                : undefined
            }
          />
        </div>
      )}
    </>
  );
});

export default DatePickerInput;
