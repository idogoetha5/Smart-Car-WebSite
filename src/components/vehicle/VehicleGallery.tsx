'use client';

import { useState, useEffect, useRef, type PointerEvent, type KeyboardEvent } from 'react';
import { useLocale } from 'next-intl';
import Image from 'next/image';

interface Props {
  images: string[];
  alt: string;
}

function CarPlaceholder({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 48" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="16" width="72" height="22" rx="4" fill="currentColor" opacity="0.15" />
      <path d="M10 16 L20 4 L60 4 L70 16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round" />
      <circle cx="20" cy="38" r="6" fill="currentColor" />
      <circle cx="60" cy="38" r="6" fill="currentColor" />
    </svg>
  );
}

export default function VehicleGallery({ images, alt }: Props) {
  // Every string a screen reader reads out here used to be Hebrew, on the
  // English page too — the alt text, the group name and each thumbnail.
  const isHe = useLocale() === 'he';
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Tracked per URL rather than per index, so switching thumbnails cannot
  // carry a previous image's failure over to a working one.
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!expanded || !dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded]);

  const select = (index: number) => {
    const next = (index + images.length) % images.length;
    setActive(next);
    // Scroll only the strip, never move the whole document when swiping.
    const thumb = thumbnailRefs.current[next];
    if (thumb?.parentElement) {
      const strip = thumb.parentElement;
      const bounds = strip.getBoundingClientRect();
      const target = thumb.getBoundingClientRect();
      if (target.left < bounds.left) strip.scrollBy({ left: target.left - bounds.left });
      else if (target.right > bounds.right) strip.scrollBy({ left: target.right - bounds.right });
    }
  };
  const startGesture = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse') return;
    gesture.current = { x: event.clientX, y: event.clientY };
    swiped.current = false;
  };
  const endGesture = (event: PointerEvent<HTMLElement>) => {
    const start = gesture.current;
    gesture.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy) * 1.3) return;
    swiped.current = true;
    select(active + ((isHe ? dx > 0 : dx < 0) ? 1 : -1));
  };
  const handleArrows = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    select(active + ((isHe ? event.key === 'ArrowLeft' : event.key === 'ArrowRight') ? 1 : -1));
  };

  if (!images.length) {
    return (
      <div className="aspect-video bg-[#eef6f6] rounded-2xl flex items-center justify-center mb-6">
        <CarPlaceholder className="w-32 h-20 text-[#2D5F5F]" />
      </div>
    );
  }

  const index = active % images.length;
  const current = images[index];
  const currentFailed = failed[current];

  return (
    <div className="mb-6">
      {/*
        The main image is a plain `fill` image inside this relative box.
        Do not wrap it in anything that sets a transform or
        `transform-style: preserve-3d` — that establishes a containing block
        for absolutely positioned descendants, and a wrapper with no height
        of its own then collapses the image to nothing. That is exactly how
        this gallery rendered blank on every vehicle while the thumbnails
        still worked.
      */}
      <div
        className="aspect-video bg-[#eef6f6] rounded-2xl overflow-hidden mb-3 relative"
        aria-live="polite"
        onPointerDown={startGesture}
        onPointerUp={endGesture}
        onPointerCancel={() => { gesture.current = null; }}
        onKeyDown={handleArrows}
        style={{ touchAction: 'pan-y pinch-zoom' }}
      >
        <button
          type="button"
          aria-label={isHe ? 'הגדלת תמונת הרכב למסך מלא' : 'Open vehicle image full screen'}
          onClick={() => {
            if (swiped.current) { swiped.current = false; return; }
            setExpanded(true);
          }}
          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#2D5F5F]"
        >
          <span className="absolute top-2 end-2 rounded-full bg-white/95 px-3 py-2 text-xs font-medium text-[#0D2B2B] shadow-sm">
            {isHe ? '⤢ הגדלה' : '⤢ Enlarge'}
          </span>
        </button>
        {currentFailed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#2D5F5F]">
            <CarPlaceholder className="w-28 h-16" />
            <p className="text-xs text-gray-600">{isHe ? 'תמונה לא זמינה' : 'Image unavailable'}</p>
          </div>
        ) : (
          <Image
            key={current}
            src={current}
            alt={isHe
              ? `${alt} — תמונה ${index + 1} מתוך ${images.length}`
              : `${alt} — image ${index + 1} of ${images.length}`}
            fill
            priority={active === 0}
            // object-contain keeps the whole vehicle visible; the modest
            // padding stops it touching the rounded corners. No scale here —
            // a transform shrank it to 65% of an already-small box.
            className="object-contain p-4"
            sizes="(max-width: 768px) 100vw, 50vw"
            onError={() => setFailed((prev) => ({ ...prev, [current]: true }))}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mb-2 text-xs text-gray-600">
        <span>{isHe ? 'החליקו בין התמונות · לחצו להגדלה' : 'Swipe to browse · tap to enlarge'}</span>
        <span dir="ltr" className="shrink-0 tabular-nums" aria-hidden="true">{index + 1} / {images.length}</span>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={isHe ? 'תמונות הרכב' : 'Vehicle images'}>
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              ref={(node) => { thumbnailRefs.current[i] = node; }}
              onClick={() => select(i)}
              aria-label={isHe
                ? `הצגת תמונה ${i + 1} מתוך ${images.length}`
                : `Show image ${i + 1} of ${images.length}`}
              // A button that selects one of a set reports its state with
              // aria-pressed; aria-current is for navigation.
              aria-pressed={i === index}
              className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5F5F] focus-visible:ring-offset-2 ${
                i === index ? 'border-[#B64916]' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              {failed[src] ? (
                <span className="absolute inset-0 flex items-center justify-center bg-[#eef6f6] text-[#2D5F5F]">
                  <CarPlaceholder className="w-10 h-6" />
                </span>
              ) : (
                <Image
                  src={src}
                  alt=""
                  fill
                  className="object-contain bg-[#eef6f6]"
                  sizes="80px"
                  onError={() => setFailed((prev) => ({ ...prev, [src]: true }))}
                />
              )}
            </button>
          ))}
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-label={isHe ? `תמונות ${alt} במסך מלא` : `${alt} full-screen gallery`}
        onClose={() => setExpanded(false)}
        onKeyDown={handleArrows}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-[#0D2B2B] p-0 text-white backdrop:bg-black/80"
      >
        {expanded && (
          <div className="flex h-full min-h-0 flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <div className="flex shrink-0 items-center justify-between gap-3 p-3 sm:px-6">
              <p className="min-w-0 text-sm font-medium">{alt}</p>
              <button ref={closeRef} type="button" onClick={() => setExpanded(false)} className="min-h-12 min-w-12 shrink-0 rounded-full border border-white/30 px-4 text-sm focus-visible:outline-2 focus-visible:outline-white">
                {isHe ? 'סגירה ✕' : 'Close ✕'}
              </button>
            </div>
            <div
              className="relative min-h-0 flex-1"
              style={{ touchAction: 'pan-y pinch-zoom' }}
              onPointerDown={startGesture}
              onPointerUp={endGesture}
              onPointerCancel={() => { gesture.current = null; }}
            >
              {currentFailed ? (
                <div className="absolute inset-0 flex items-center justify-center">{isHe ? 'תמונה לא זמינה' : 'Image unavailable'}</div>
              ) : (
                <Image src={current} alt={`${alt} — ${index + 1} / ${images.length}`} fill sizes="100vw" className="object-contain p-2 sm:p-6" onError={() => setFailed(prev => ({ ...prev, [current]: true }))} />
              )}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-4 p-3 sm:px-6">
              <button type="button" disabled={images.length < 2} onClick={() => select(active - 1)} className="min-h-12 min-w-20 rounded-xl border border-white/30 px-4 disabled:opacity-40">{isHe ? 'הקודמת' : 'Previous'}</button>
              <p dir="ltr" aria-live="polite" className="text-sm tabular-nums">{index + 1} / {images.length}</p>
              <button type="button" disabled={images.length < 2} onClick={() => select(active + 1)} className="min-h-12 min-w-20 rounded-xl border border-white/30 px-4 disabled:opacity-40">{isHe ? 'הבאה' : 'Next'}</button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
