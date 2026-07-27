'use client';

import Link from 'next/link';

/**
 * Short notice shown next to a form's submit action, at every point where
 * personal data is collected (contact / booking / leasing).
 *
 * Deliberately brief and human — the full disclosure (purposes,
 * controller and contact, voluntary vs required, recipients, access and
 * correction rights) lives in the Privacy Policy, reachable from here by
 * a clearly-named link. A long legal paragraph at the point of collection
 * is not required and is not used.
 */
export default function PrivacyNotice({ locale }: { locale: string }) {
  const isHe = locale === 'he';
  return (
    <p className="text-xs text-gray-600 leading-relaxed">
      {isHe
        ? 'נשתמש בפרטים כדי לטפל בפנייה ולחזור אליכם. מסירתם אינה חובה, אך ללא שדות החובה לא נוכל לטפל בבקשה. '
        : 'We use your details to handle your request and get back to you. Providing them is not mandatory, but without the required fields we cannot process your request. '}
      <Link
        href={`/${isHe ? 'he' : 'en'}/privacy`}
        className="text-[#2D5F5F] underline hover:text-[#B64916] focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] focus:ring-offset-2 rounded"
      >
        {isHe ? 'מידע נוסף על השימוש בפרטים' : 'More about how we use your details'}
      </Link>
    </p>
  );
}
