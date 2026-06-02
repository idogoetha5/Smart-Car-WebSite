'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { DayPicker } from 'react-day-picker';
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
  isHe?: boolean;
  className?: string;
}

const DatePickerInput = forwardRef<DatePickerHandle, DatePickerInputProps>(function DatePickerInput(
  { value, onChange, minDate, placeholder, isHe = true, className = '' },
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

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || calRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = false;
    const timer = setTimeout(() => { active = true; }, 200);
    const onScroll = () => { if (active) setOpen(false); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [open]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    onChange(toYMD(date));
    setOpen(false);
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
        className={`text-start bg-transparent outline-none ${className}`}
      >
        {display ? (
          <span className="text-sm text-gray-800 font-medium">{display}</span>
        ) : (
          <span className="text-sm text-gray-400">{placeholder}</span>
        )}
      </button>

      {open && (
        <div
          ref={calRef}
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
          />
        </div>
      )}
    </>
  );
});

export default DatePickerInput;
