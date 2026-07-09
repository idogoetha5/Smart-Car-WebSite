'use client';

import { useState } from 'react';
import Image from 'next/image';
import Tilt3D from '@/components/ui/Tilt3D';

interface Props {
  images: string[];
  alt: string;
}

export default function VehicleGallery({ images, alt }: Props) {
  const [active, setActive] = useState(0);

  if (!images.length) {
    return (
      <div className="aspect-video bg-[#eef6f6] rounded-2xl flex items-center justify-center mb-6">
        <svg viewBox="0 0 80 48" fill="none" className="w-32 h-20 text-[#2D5F5F]" aria-hidden="true">
          <rect x="4" y="16" width="72" height="22" rx="4" fill="currentColor" opacity="0.15"/>
          <path d="M10 16 L20 4 L60 4 L70 16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round"/>
          <circle cx="20" cy="38" r="6" fill="currentColor"/>
          <circle cx="60" cy="38" r="6" fill="currentColor"/>
        </svg>
      </div>
    );
  }

  return (
    <div className="mb-6">
      {/* Main image */}
      <div className="aspect-video bg-[#eef6f6] rounded-2xl overflow-hidden mb-3 relative">
        <Tilt3D>
          <Image
            key={images[active]}
            src={images[active]}
            alt={`${alt} — תמונה ${active + 1}`}
            fill
            priority={active === 0}
            className="object-contain p-2 scale-[0.65]"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </Tilt3D>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all relative ${
                i === active ? 'border-[#E8743B]' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
              aria-label={`תמונה ${i + 1}`}
            >
              <Image
                src={src}
                alt={`${alt} תמונה ${i + 1}`}
                fill
                className="object-contain bg-[#eef6f6]"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
