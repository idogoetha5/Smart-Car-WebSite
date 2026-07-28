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
        ? 'נשתמש בפרטים כדי לטפל בפנייה ולחזור אליכם. אין חובה חוקית למסור אותם, אך בלי שדות החובה לא נוכל לטפל בבקשה. מידע נוסף על השימוש במידע, מסירתו לספקים וזכויותיכם מופיע ב'
        : 'We will use the details to handle your request and contact you. You are not legally required to provide them, but we cannot process the request without the required fields. More information about data use, service providers and your rights is available in the '}
      <Link
        href={`/${isHe ? 'he' : 'en'}/privacy`}
        className="text-[#2D5F5F] underline hover:text-[#B64916] focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] focus:ring-offset-2 rounded"
      >
        {isHe ? 'מדיניות הפרטיות' : 'Privacy Policy'}
      </Link>
      {isHe ? '.' : '.'}
    </p>
  );
}
