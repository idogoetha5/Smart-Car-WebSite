'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { clearOfficeDrafts } from '@/lib/quote-drafts';
import { clearBookingContext } from '@/lib/use-booking-context';
import {
  Car,
  CalendarCheck,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Tag,
  Star,
  Send,
  MessageCircle,
  MessagesSquare,
  ClipboardList,
  Users,
  Table2,
  X,
} from 'lucide-react';

/**
 * Admin navigation.
 *
 * From `md` up this is the fixed 16rem rail it has always been. Below that it
 * was still rendered at a fixed 16rem beside the content, which left a phone
 * roughly a hundred pixels for the page itself and scrolled the whole
 * document sideways. On small screens it is now a compact bar plus a drawer
 * over the content.
 */
export default function AdminSidebar() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const isHe = locale === 'he';

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Escape closes and hands focus back to the control that opened it, so a
  // keyboard user is never stranded behind the overlay. role="dialog" alone
  // doesn't stop Tab from leaving the drawer into the page behind it — the
  // page is still in the DOM, just visually covered — so Tab/Shift+Tab past
  // either end has to be caught and wrapped back inside by hand.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); return; }
      if (e.key !== 'Tab') return;

      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    // The page behind an overlay must not scroll with it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleLogout = async () => {
    const response = await fetch('/api/admin/login', { method: 'DELETE' });
    if (!response.ok) return;
    try { clearOfficeDrafts(localStorage); } catch { /* Storage may be disabled on a private browser. */ }
    clearBookingContext();
    router.push(`/${locale}/admin/login`);
  };

  // This is the office's daily flow. Keep the exact order on desktop and in
  // the phone drawer so switching devices never means relearning the app.
  const links = [
    { href: `/${locale}/admin`, label: 'Dashboard', icon: LayoutDashboard },
    { href: `/${locale}/admin/bookings`, label: t('manage_bookings'), icon: CalendarCheck },
    { href: `/${locale}/admin/rental-quotes`, label: isHe ? 'הצעת מחיר להשכרה' : 'Rental quotation', icon: MessageCircle },
    { href: `/${locale}/admin/quotes`, label: isHe ? 'הצעת מחיר לליסינג' : 'Leasing quotation', icon: Send },
    { href: `/${locale}/admin/vehicles`, label: t('manage_vehicles'), icon: Car },
    { href: `/${locale}/admin/cars-for-sale`, label: isHe ? 'ניהול רכבים למכירה' : 'Cars for sale', icon: Tag },
    { href: `/${locale}/admin/leasing-requests`, label: t('manage_leasing'), icon: FileText },
    { href: `/${locale}/admin/inbox`, label: isHe ? 'וואטסאפ' : 'WhatsApp inbox', icon: MessagesSquare },
    { href: `/${locale}/admin/leads`, label: isHe ? 'פניות ולידים' : 'Leads & enquiries', icon: Table2 },
    { href: `/${locale}/admin/customer-details`, label: isHe ? 'טפסי לקוחות' : 'Customer forms', icon: ClipboardList },
    { href: `/${locale}/admin/drivers`, label: isHe ? 'נהגים' : 'Drivers', icon: Users },
    { href: `/${locale}/admin/reviews`, label: isHe ? 'ביקורות' : 'Reviews', icon: Star },
    { href: `/${locale}/admin/quote-history`, label: isHe ? 'היסטוריית הצעות מחיר ליסינג' : 'Leasing quote history', icon: History },
  ];
  const mobileMainLinks = links.filter((link) => [
    `/${locale}/admin`,
    `/${locale}/admin/bookings`,
    `/${locale}/admin/rental-quotes`,
  ].includes(link.href));

  const nav = (
    <>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? 'page' : undefined}
              // Closed on the click rather than by watching the pathname:
              // that would be a setState inside an effect, which is the very
              // pattern this codebase just finished removing.
              onClick={() => setOpen(false)}
              className={`flex min-h-14 items-center gap-3 rounded-xl py-3 pe-4 ps-4 text-base font-bold transition-colors ${
                isActive ? 'bg-[#2D5F5F] text-white shadow-[0_8px_20px_rgba(45,95,95,0.24)]' : 'hover:bg-[#1A3A3A] hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl px-4 py-3 text-base font-bold transition-colors hover:bg-[#1A3A3A] hover:text-white"
        >
          <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
          {isHe ? 'התנתק' : 'Logout'}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop rail — unchanged */}
      <aside className="hidden min-h-screen w-64 shrink-0 flex-col bg-[#0D2B2B] text-[#D5E8E8] md:flex">
        <div className="border-b border-white/10 p-6">
          <div className="flex items-center gap-2 text-lg font-black text-white">
            <Car className="h-6 w-6 text-[#B8D8D8]" aria-hidden="true" />
            SmartCar Admin
          </div>
        </div>
        {nav}
      </aside>

      {/* Compact bar, small screens only. Sticky so the menu stays reachable
          after scrolling a long list, and padded for the iPhone notch. */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-[#0D2B2B] px-4 py-3 text-white shadow-[0_6px_20px_rgba(13,43,43,0.14)] md:hidden"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-1">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-label={isHe ? 'פתיחת תפריט ניהול' : 'Open admin menu'}
            aria-expanded={open}
            aria-controls="admin-drawer"
            className="-me-2 flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8D8D8]"
          >
            <Menu className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-lg font-black">
          <Car className="h-6 w-6 shrink-0 text-[#B8D8D8]" aria-hidden="true" />
          <span className="truncate">SmartCar Admin</span>
        </div>
      </div>

      {/* Phone navigation stays deliberately short; every secondary screen is
          one tap away in “more”, instead of shrinking thirteen choices into
          an unreadable bar. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(13,43,43,0.10)] backdrop-blur md:hidden" aria-label={isHe ? 'ניווט ראשי' : 'Main navigation'}>
        {mobileMainLinks.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href;
          const label = link.href.endsWith('/admin') ? (isHe ? 'ראשי' : 'Home') : link.label;
          return (
            <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined} className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-black ${active ? 'text-[#2D5F5F]' : 'text-slate-400'}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-black text-slate-400" aria-expanded={open} aria-controls="admin-drawer">
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
          <span>{isHe ? 'עוד' : 'More'}</span>
        </button>
      </nav>

      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Clicking away closes. aria-hidden because the button inside the
              drawer is the labelled way out for anyone not using a pointer. */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => { setOpen(false); triggerRef.current?.focus(); }}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            id="admin-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={isHe ? 'תפריט ניהול' : 'Admin menu'}
            // Logical inset: opens from the right in Hebrew and the left in
            // English without needing two sets of classes.
            className="absolute inset-y-0 start-0 flex w-[min(18rem,85vw)] max-w-full flex-col bg-[#0D2B2B] text-[#D5E8E8] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/10 p-4">
              <div className="flex min-w-0 items-center gap-2 font-black text-white">
                <Car className="h-5 w-5 shrink-0 text-[#B8D8D8]" aria-hidden="true" />
                <span className="truncate">SmartCar Admin</span>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => { setOpen(false); triggerRef.current?.focus(); }}
                aria-label={isHe ? 'סגירת תפריט' : 'Close menu'}
                className="-me-2 flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8D8D8]"
              >
                <X className="w-6 h-6" aria-hidden="true" />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
