import Image from 'next/image';
import type { ReactNode } from 'react';

/**
 * SmartCar look for the driver and manager apps — the same white bar with
 * the logo and light-blue hero band as the public site (Navbar + HeroSection).
 */
export function BrandBar({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Image src="/images/logo.png" alt="SmartCar" width={112} height={50} className="h-9 w-auto object-contain" priority />
          <span className="rounded-full bg-[#eef6f6] px-3 py-1 text-sm font-black text-[#2D5F5F]">{label}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">{children}</div>
      </div>
    </header>
  );
}

export function BrandHero({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-b-[28px] bg-[#D6EEF5] px-4 pb-5 pt-5 sm:rounded-b-[40px] sm:px-8 sm:pb-7">
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </div>
  );
}

export const brandIconButton =
  'flex h-11 w-11 items-center justify-center rounded-xl text-[#2D5F5F] hover:bg-[#eef6f6] active:bg-[#d9ecec]';
