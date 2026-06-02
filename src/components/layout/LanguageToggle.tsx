'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

export default function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggle = () => {
    const newLocale = locale === 'he' ? 'en' : 'he';
    router.push(pathname.replace(`/${locale}`, `/${newLocale}`));
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-sm font-medium hover:bg-gray-50 transition-colors"
      aria-label="Toggle language"
    >
      <span>{locale === 'he' ? '🇮🇱 עב' : '🇺🇸 EN'}</span>
      <span className="text-gray-400">→</span>
      <span>{locale === 'he' ? 'EN' : 'עב'}</span>
    </button>
  );
}
