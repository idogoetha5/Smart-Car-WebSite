import { OFFICE_EMAIL, OFFICE_PHONE } from '@/lib/constants';

/**
 * The single contact block for accessibility and privacy enquiries.
 *
 * Four copies of these details existed across the two legal pages and the
 * two locales, and they had already drifted: the English accessibility page
 * printed the phone number as plain text with no `tel:` link and gave no
 * address at all, while the others carried a postcode.
 *
 * Deliberately the office, not a person and not a role. Nothing here names
 * an "accessibility coordinator" or a "privacy officer" — those are
 * statutory appointments, and who holds them has not been established.
 */
export default function LegalContact({
  topic,
  locale,
}: {
  topic: 'accessibility' | 'privacy';
  locale: string;
}) {
  const isHe = locale === 'he';

  const heading = isHe
    ? topic === 'accessibility'
      ? 'פניות בנושא נגישות'
      : 'פניות בנושא פרטיות'
    : topic === 'accessibility'
      ? 'Accessibility Contact'
      : 'Privacy Contact';

  const address = isHe ? 'רמת ים 122, הרצליה' : 'Ramat Yam 122, Herzliya, Israel';

  return (
    <section>
      <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">{heading}</h2>
      <ul className="list-none space-y-2">
        <li>
          <span aria-hidden="true">📧</span>{' '}
          <a href={`mailto:${OFFICE_EMAIL}`} className="text-[#2D5F5F] underline">
            {OFFICE_EMAIL}
          </a>
        </li>
        <li>
          <span aria-hidden="true">📞</span>{' '}
          {/* The visible text is formatted for reading; the href is what the
              phone actually dials. */}
          <a href={`tel:${OFFICE_PHONE}`} className="text-[#2D5F5F] underline">
            {OFFICE_PHONE}
          </a>
        </li>
        <li>
          <span aria-hidden="true">📍</span> {address}
        </li>
      </ul>
    </section>
  );
}
