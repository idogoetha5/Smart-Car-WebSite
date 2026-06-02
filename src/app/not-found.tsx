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
        <p className="text-[#E8743B] text-sm font-semibold uppercase tracking-widest mb-2">SmartCar</p>
        <h1 className="text-7xl font-black text-[#0D2B2B] mb-3">404</h1>
        <p className="text-xl text-gray-600 mb-2">הדף לא נמצא</p>
        <p className="text-gray-400 text-sm mb-8">Page not found</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/he"
            className="px-6 py-3 bg-[#2D5F5F] text-white font-bold rounded-xl hover:bg-[#1A3A3A] transition-colors"
          >
            חזרה לדף הבית
          </Link>
          <Link
            href="/en"
            className="px-6 py-3 border-2 border-[#2D5F5F] text-[#2D5F5F] font-bold rounded-xl hover:bg-[#2D5F5F]/5 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
