'use client';

import { useId, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { compressImage } from '@/lib/image-compress';
import { resolveVehicleImageUrl } from '@/lib/car-images';

interface Props {
  value: string;
  onChange: (url: string) => void;
  onBusyChange: (busy: boolean) => void;
  isHe?: boolean;
  disabled?: boolean;
}

export default function VehicleImageUpload({ value, onChange, onBusyChange, isHe = true, disabled = false }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const previewUrl = resolveVehicleImageUrl(value);

  const upload = async (file?: File) => {
    if (!file || busy || disabled) return;
    setError('');
    if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) {
      setError(isHe ? 'יש לבחור תמונה עד 20MB.' : 'Choose an image up to 20MB.');
      return;
    }
    setBusy(true);
    onBusyChange(true);
    try {
      const compressed = await compressImage(file, 2000, 0.85);
      if (compressed.size > 3 * 1024 * 1024) throw new Error(isHe ? 'התמונה גדולה מדי. נסה תמונה קטנה יותר או שמור אותה כ־JPG.' : 'Image too large. Try a smaller photo or save it as JPG.');
      const body = new FormData();
      body.append('file', compressed, 'vehicle-photo');
      const response = await fetch('/api/admin/vehicle-image', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || (isHe ? 'העלאת התמונה נכשלה' : 'Upload failed'));
      onChange(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (isHe ? 'העלאת התמונה נכשלה. נסה שוב.' : 'Upload failed. Try again.'));
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-[#dce8e8] bg-[#f6f9f9] p-4" aria-label={isHe ? 'תמונת הרכב' : 'Vehicle photo'} aria-busy={busy}>
      <div className="flex items-center gap-2 text-sm font-bold text-[#0D2B2B]"><Camera className="h-5 w-5" aria-hidden="true" />{isHe ? 'תמונת הרכב' : 'Vehicle photo'}</div>
      {previewUrl && <div className="relative h-44 overflow-hidden rounded-xl bg-white"><Image src={previewUrl} alt={isHe ? 'התמונה שנבחרה לרכב' : 'Selected vehicle photo'} fill sizes="(max-width: 640px) 100vw, 600px" className="object-contain" unoptimized /></div>}
      <input ref={inputRef} id={id} type="file" accept="image/*" className="sr-only" disabled={busy || disabled} aria-describedby={`${id}-help`} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void upload(file); }} />
      <div className="flex gap-2">
        <button type="button" disabled={busy || disabled} onClick={() => inputRef.current?.click()} className="flex min-h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-[#b9cece] bg-white px-3 text-sm font-bold text-[#2D5F5F] transition hover:bg-[#eef6f6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D5F5F] disabled:opacity-60">
          {busy ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-5 w-5 shrink-0" aria-hidden="true" />}
          {busy ? (isHe ? 'מעלה תמונה…' : 'Uploading…') : value ? (isHe ? 'החלפת תמונה' : 'Replace photo') : (isHe ? 'בחירת תמונה מהטלפון' : 'Choose a photo')}
        </button>
        {value && <button type="button" disabled={busy || disabled} onClick={() => onChange('')} aria-label={isHe ? 'הסרת התמונה מהטופס' : 'Remove photo from form'} className="flex min-h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-red-600 disabled:opacity-50"><Trash2 className="h-5 w-5" /></button>}
      </div>
      <p id={`${id}-help`} className="text-xs leading-5 text-slate-500">{isHe ? 'מהגלריה או מהמצלמה · התמונה תוקטן לשמירה על איכות וטעינה מהירה' : 'Photo library or camera · Optimized for quality and fast loading'}</p>
      <p role="status" className="sr-only">{busy ? (isHe ? 'התמונה עולה, יש להמתין לפני השמירה' : 'Uploading, please wait before saving') : value ? (isHe ? 'התמונה מוכנה לשמירה' : 'Photo ready to save') : ''}</p>
      {error && <p role="alert" className="text-sm leading-6 text-red-700">{error}</p>}
    </section>
  );
}
