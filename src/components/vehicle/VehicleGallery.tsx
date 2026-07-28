'use client';

import { useState } from 'react';
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
  const [active, setActive] = useState(0);
  // Tracked per URL rather than per index, so switching thumbnails cannot
  // carry a previous image's failure over to a working one.
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  if (!images.length) {
    return (
      <div className="aspect-video bg-[#eef6f6] rounded-2xl flex items-center justify-center mb-6">
        <CarPlaceholder className="w-32 h-20 text-[#2D5F5F]" />
      </div>
    );
  }

  const current = images[active];
  const currentFailed = failed[current];

  return (
    <div className="mb-6">
      {/*
        The main image is a plain `fill` image inside this relative box.
        It must NOT be wrapped in Tilt3D: that component sets
        `transform-style: preserve-3d`, which makes its own zero-height div
        the containing block for absolutely positioned descendants — so the
        `fill` image sized itself to nothing and the main image rendered
        blank on every vehicle while the thumbnails still worked.
      */}
      <div className="aspect-video bg-[#eef6f6] rounded-2xl overflow-hidden mb-3 relative">
        {currentFailed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#2D5F5F]">
            <CarPlaceholder className="w-28 h-16" />
            <p className="text-xs text-gray-600">תמונה לא זמינה / Image unavailable</p>
          </div>
        ) : (
          <Image
            key={current}
            src={current}
            alt={`${alt} — תמונה ${active + 1} מתוך ${images.length}`}
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

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="תמונות הרכב">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`הצגת תמונה ${i + 1} מתוך ${images.length}`}
              aria-current={i === active ? 'true' : undefined}
              className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5F5F] focus-visible:ring-offset-2 ${
                i === active ? 'border-[#B64916]' : 'border-transparent opacity-60 hover:opacity-100'
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
    </div>
  );
}
