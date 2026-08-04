'use client';

import Image from 'next/image';
import { Phone, MapPin, Clock } from 'lucide-react';
import { BRANCHES, mapsUrl, wazeUrl, type BranchId } from '@/lib/branches';

// Opening hours are the only branch detail not held in @/lib/branches —
// they are operational copy rather than identity, so they stay here.
const HOURS: Record<BranchId, { he: string; en: string }> = {
  herzliya:  { he: 'א–ה 08:00–18:00', en: 'Sun–Thu 08:00–18:00' },
  telaviv:   { he: 'א–ה 08:00–18:00', en: 'Sun–Thu 08:00–18:00' },
  jerusalem: { he: 'א–ה 08:00–18:00', en: 'Sun–Thu 08:00–18:00' },
  airport:   { he: 'שירות משלוח 24/7',                en: '24/7 Delivery Service' },
};

const branches = BRANCHES.map((b) => ({
  nameHe: b.nameHe,
  nameEn: b.nameEn,
  addressHe: `${b.streetHe}, ${b.cityHe}`,
  addressEn: `${b.streetEn}, ${b.cityEn}`,
  phone: b.phone,
  hoursHe: HOURS[b.id].he,
  hoursEn: HOURS[b.id].en,
  wazeUrl: wazeUrl(b),
  mapsUrl: mapsUrl(b),
  image: b.image,
}));

export default function BranchesSection({ locale }: { locale: string }) {
  const isHe = locale === 'he';

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`mb-12 ${isHe ? 'text-right' : 'text-left'}`}>
          <p className="text-[#B64916] text-sm font-semibold uppercase tracking-widest mb-2">
            {isHe ? 'נקודות שירות' : 'Our Locations'}
          </p>
          <h2 className="text-4xl font-black text-[#0D2B2B]">
            {isHe ? 'הסניפים שלנו' : 'Our Branches'}
          </h2>
          <p className="text-gray-600 mt-2 max-w-xl">
            {isHe
              ? 'מגיעים אליכם בכל רחבי הארץ – 4 סניפים לשירותכם'
              : 'We come to you across the country – 4 branches at your service'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {branches.map((branch) => (
            <div
              key={branch.nameEn}
              className="group rounded-2xl overflow-hidden border border-gray-100 shadow-md hover:shadow-xl hover:border-[#B8D8D8] transition-all duration-300 flex flex-col bg-white"
            >
              <div className="relative h-40 overflow-hidden bg-[#eef6f6]">
                <Image
                  src={branch.image}
                  alt={isHe ? `${branch.nameHe} – ${branch.addressHe}` : `${branch.nameEn} – ${branch.addressEn}`}
                  fill
                  loading="lazy"
                  className="object-cover"
                />
              </div>

              <div
                className="flex-1"
                style={{
                  padding: '16px',
                  display: 'grid',
                  gridTemplateRows: '22px 24px 40px 14px 1fr',
                  rowGap: '10px',
                  direction: isHe ? 'rtl' : 'ltr',
                }}
              >
                {/* Row 1 – 22px: branch name */}
                <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#0D2B2B', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {isHe ? branch.nameHe : branch.nameEn}
                </h3>

                {/* Row 2 – 24px: phone (before address so nothing variable sits above it) */}
                {branch.phone ? (
                  <a
                    href={`tel:${branch.phone}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#B64916', fontWeight: 600, textDecoration: 'none' }}
                  >
                    <Phone className="w-4 h-4" style={{ flexShrink: 0 }} />
                    {branch.phone}
                  </a>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#B64916', fontWeight: 600 }}>
                    <Clock className="w-4 h-4" style={{ flexShrink: 0 }} />
                    {isHe ? 'שירות 24/7' : '24/7 Service'}
                  </div>
                )}

                {/* Row 3 – 40px: address */}
                <div style={{ overflow: 'hidden', display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '13px', color: '#4B5563' }}>
                  <MapPin className="w-4 h-4 text-[#2D5F5F] mt-0.5" style={{ flexShrink: 0 }} />
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {isHe ? branch.addressHe : branch.addressEn}
                  </span>
                </div>

                {/* Row 4 – 14px: hours */}
                <div style={{ fontSize: '11px', color: '#6B7280', textAlign: isHe ? 'right' : 'left', overflow: 'hidden' }}>
                  {isHe ? branch.hoursHe : branch.hoursEn}
                </div>

                {/* Row 5 – 1fr: buttons at bottom */}
                <div style={{ alignSelf: 'end', paddingTop: '8px', borderTop: '1px solid #F9FAFB', display: 'flex', gap: '8px' }}>
                  <a
                    href={branch.wazeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 text-center text-xs font-bold rounded-lg bg-[#2D5F5F] text-white hover:bg-[#1A3A3A] transition-colors"
                  >
                    Waze
                  </a>
                  <a
                    href={branch.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 text-center text-xs font-bold rounded-lg border-2 border-[#2D5F5F] text-[#2D5F5F] hover:bg-[#eef6f6] transition-colors"
                  >
                    {isHe ? 'מפות' : 'Maps'}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
