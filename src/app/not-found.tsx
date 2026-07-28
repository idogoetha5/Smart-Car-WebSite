import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <svg viewBox="0 0 80 48" fill="none" className="w-32 h-20 text-[#2D5F5F] mx-auto" aria-hidden="true">
            <rect x="4" y="16" width="72" height="22" rx="4" fill="currentColor" opacity="0.15"/>
            <path d="M10 16 L20 4 L60 4 L70 16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round"/>
            <circle cx="20" cy="38" r="6" fill="currentColor"/>
            <circle cx="60" cy="38" r="6" fill="currentColor"/>
          </svg>
        </div>
        <p className="text-[#B64916] text-sm font-semibold uppercase tracking-widest mb-2">SmartCar</p>
        <h1 className="text-7xl font-black text-[#0D2B2B] mb-3">404</h1>
        <p className="text-xl text-gray-900 mb-2">הדף לא נמצא</p>
        <p className="text-gray-600 text-sm mb-1">Page not found</p>
        {/* Bilingual on purpose: this handles paths that never entered a
            /[locale] segment, so there is no locale to read. The localised
            version under [locale] covers routes that call notFound(). */}
        <p className="text-gray-600 text-sm mb-8">
          ייתכן שהקישור ישן. אפשר להמשיך מכאן:
          <br />
          <span className="text-gray-500">The link may be out of date. Continue from here:</span>
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
          <Link
            href="/he/rental"
            className="px-6 py-3 bg-[#2D5F5F] text-white font-bold rounded-xl hover:bg-[#1A3A3A] transition-colors"
          >
            לצי הרכבים
          </Link>
          <Link
            href="/en/rental"
            className="px-6 py-3 bg-[#2D5F5F] text-white font-bold rounded-xl hover:bg-[#1A3A3A] transition-colors"
          >
            Browse the fleet
          </Link>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/he"
            className="px-6 py-3 border-2 border-[#2D5F5F] text-[#2D5F5F] font-bold rounded-xl hover:bg-[#2D5F5F]/5 transition-colors"
          >
            דף הבית
          </Link>
          <Link
            href="/he/contact"
            className="px-6 py-3 border-2 border-[#2D5F5F] text-[#2D5F5F] font-bold rounded-xl hover:bg-[#2D5F5F]/5 transition-colors"
          >
            צרו קשר
          </Link>
          <Link
            href="/en"
            className="px-6 py-3 border-2 border-[#2D5F5F] text-[#2D5F5F] font-bold rounded-xl hover:bg-[#2D5F5F]/5 transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
