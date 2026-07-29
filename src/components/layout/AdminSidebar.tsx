'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Car,
  CalendarCheck,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Tag,
  Star,
  Send,
  MessageCircle,
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

  // Escape closes and hands focus back to the control that opened it, so a
  // keyboard user is never stranded behind the overlay.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
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
    await fetch('/api/admin/login', { method: 'DELETE' });
    router.push(`/${locale}/admin/login`);
  };

  const links = [
    { href: `/${locale}/admin`, label: 'Dashboard', icon: LayoutDashboard },
    { href: `/${locale}/admin/vehicles`, label: t('manage_vehicles'), icon: Car },
    { href: `/${locale}/admin/bookings`, label: t('manage_bookings'), icon: CalendarCheck },
    { href: `/${locale}/admin/leasing-requests`, label: t('manage_leasing'), icon: FileText },
    { href: `/${locale}/admin/cars-for-sale`, label: isHe ? 'ניהול רכבים למכירה' : 'Cars for sale', icon: Tag },
    { href: `/${locale}/admin/reviews`, label: isHe ? 'ביקורות' : 'Reviews', icon: Star },
    {
      href: `/${locale}/admin/quotes`,
      label: isHe ? 'הצעת מחיר ליסינג' : 'Leasing quotation',
      icon: Send,
    },
    {
      href: `/${locale}/admin/rental-quotes`,
      label: isHe ? 'הצעת מחיר להשכרה' : 'Rental quotation',
      icon: MessageCircle,
    },
    {
      href: `/${locale}/admin/quote-history`,
      label: isHe ? 'היסטוריית הצעות מחיר ליסינג' : 'Leasing quote history',
      icon: History,
    },
  ];

  const nav = (
    <>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium hover:bg-gray-800 hover:text-white transition-colors"
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
      <aside className="hidden md:flex w-64 shrink-0 bg-gray-900 text-gray-300 min-h-screen flex-col">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <Car className="w-6 h-6 text-blue-400" aria-hidden="true" />
            SmartCar Admin
          </div>
        </div>
        {nav}
      </aside>

      {/* Compact bar, small screens only. Sticky so the menu stays reachable
          after scrolling a long list, and padded for the iPhone notch. */}
      <div
        className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 bg-gray-900 text-white px-4 py-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2 font-bold min-w-0">
          <Car className="w-5 h-5 text-blue-400 shrink-0" aria-hidden="true" />
          <span className="truncate">SmartCar Admin</span>
        </div>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={isHe ? 'פתיחת תפריט ניהול' : 'Open admin menu'}
          aria-expanded={open}
          aria-controls="admin-drawer"
          className="flex items-center justify-center w-11 h-11 -me-2 rounded-lg hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <Menu className="w-6 h-6" aria-hidden="true" />
        </button>
      </div>

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
            id="admin-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={isHe ? 'תפריט ניהול' : 'Admin menu'}
            // Logical inset: opens from the right in Hebrew and the left in
            // English without needing two sets of classes.
            className="absolute inset-y-0 start-0 w-[min(18rem,85vw)] max-w-full bg-gray-900 text-gray-300 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2 p-4 border-b border-gray-800">
              <div className="flex items-center gap-2 text-white font-bold min-w-0">
                <Car className="w-5 h-5 text-blue-400 shrink-0" aria-hidden="true" />
                <span className="truncate">SmartCar Admin</span>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => { setOpen(false); triggerRef.current?.focus(); }}
                aria-label={isHe ? 'סגירת תפריט' : 'Close menu'}
                className="flex items-center justify-center w-11 h-11 -me-2 rounded-lg hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
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
