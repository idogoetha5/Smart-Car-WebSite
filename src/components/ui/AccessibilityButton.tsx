'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Accessibility } from 'lucide-react';
import { hidesSiteHeader } from '@/lib/site-chrome';

/**
 * Standing link to the accessibility statement, required to be reachable
 * from every page.
 *
 * It used to sit at `top-4 left-4 z-50`, the same layer as the header and
 * earlier in the DOM, so on every page that has a header the header simply
 * painted over it. It only looked fine on a vehicle page — because that is
 * where the header is hidden.
 *
 * Rather than win the z-index race, it steps out of the way: below the
 * 4rem header where there is one, at the top edge where there is not. That
 * keeps it clear of the logo, the language toggle and the menu trigger at
 * every width, and `z-40` deliberately sits *under* the header so an open
 * mobile menu covers the button instead of fighting it for the same pixels.
 */
export default function AccessibilityButton() {
  const locale = useLocale();
  const pathname = usePathname();
  const isHe = locale === 'he';

  // From `md` up: under the 4rem header, or at the top edge where the page
  // has none. Below `md` it moves to the bottom-left instead — the hero H1
  // wraps to the full width on a phone and a 44px target at the top left
  // lands directly on it, which is the one thing this button must not do.
  // The bottom-left corner is free: WhatsApp floats bottom-right, and the
  // cookie bar is z-50 so it correctly covers this while it is up.
  const desktopTop = hidesSiteHeader(pathname, locale) ? 'md:top-4' : 'md:top-20';

  return (
    <Link
      href={`/${locale}/accessibility`}
      // Sole accessible name — the emoji is decorative and hidden, so
      // without this the link reaches a screen reader unnamed.
      aria-label={isHe ? 'הצהרת נגישות' : 'Accessibility Statement'}
      className={
        // Physically left in both locales, not `start-4`: in Hebrew the
        // header puts the logo on the right and the language toggle and menu
        // trigger on the left, so a logical inset would flip it under the
        // logo. Left is the side that is clear in both directions.
        `fixed bottom-6 md:bottom-auto ${desktopTop} left-4 z-40 flex h-11 w-11 items-center justify-center ` +
        'rounded-full bg-[#2D5F5F] text-white shadow-md ' +
        // Held back a little at rest so it does not compete with the page,
        // and brought fully forward on hover and on keyboard focus. Colour
        // and opacity only: nothing here moves, scales or flashes.
        'opacity-75 hover:opacity-100 hover:bg-[#1A3A3A] focus-visible:opacity-100 ' +
        // Dark ring on a white offset: the button floats over both the white
        // page and the dark green services band, and this pair stays visible
        // against either.
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5F5F] ' +
        'focus-visible:ring-offset-2 focus-visible:ring-offset-white ' +
        'transition-[opacity,background-color] motion-reduce:transition-none'
      }
    >
      {/* A drawn icon rather than the ♿ emoji, which renders as a different
          glyph on every platform and at whatever weight the system font
          feels like. The link's aria-label is the accessible name, so the
          icon is hidden from assistive technology. */}
      <Accessibility className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}
