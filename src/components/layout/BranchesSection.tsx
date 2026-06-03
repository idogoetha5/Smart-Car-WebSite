'use client';

import Image from 'next/image';
import { Phone, MapPin, Clock } from 'lucide-react';
import { OFFICE_PHONE } from '@/lib/constants';

interface Branch {
  nameHe: string;
  nameEn: string;
  addressHe: string;
  addressEn: string;
  phone: string | null;
  hoursHe: string;
  hoursEn: string;
  wazeUrl: string;
  mapsUrl: string;
  image: string;
}

const branches: Branch[] = [
  {
    nameHe: 'סניף הרצליה',
    nameEn: 'Herzliya',
    addressHe: 'רחוב רמת ים 122 (מלון דן אכדיה)',
    addressEn: '122 Ramat Yam St (Dan Accadia Hotel)',
    phone: OFFICE_PHONE,
    hoursHe: 'א–ה 08:00–20:00 | ו 08:00–14:00',
    hoursEn: 'Sun–Thu 08:00–20:00 | Fri 08:00–14:00',
    wazeUrl: 'https://www.waze.com/live-map/directions/il/tel-aviv-district/herzliya/smart-car?navigate=yes&to=place.ChIJJXb_-pRIHRURHCc4EPqsxxE',
    mapsUrl: 'https://maps.google.com/?q=32.16278,34.79306',
    image: '/images/branch-herzliya.webp',
  },
  {
    nameHe: 'סניף תל אביב',
    nameEn: 'Tel Aviv',
    addressHe: 'מאפו 2 פינת הירקון 112',
    addressEn: '2 Mapu St, corner of 112 Hayarkon',
    phone: '03-5233073',
    hoursHe: 'א–ה 08:00–20:00 | ו 08:00–14:00',
    hoursEn: 'Sun–Thu 08:00–20:00 | Fri 08:00–14:00',
    wazeUrl: 'https://waze.com/ul?ll=32.08736,34.76853&navigate=yes',
    mapsUrl: 'https://maps.google.com/?q=32.08736,34.76853',
    image: '/images/branch-telaviv.webp',
  },
  {
    nameHe: 'סניף ירושלים',
    nameEn: 'Jerusalem',
    addressHe: 'המלך דוד 8',
    addressEn: '8 King David St',
    phone: '02-6221150',
    hoursHe: 'א–ה 08:00–20:00 | ו 08:00–14:00',
    hoursEn: 'Sun–Thu 08:00–20:00 | Fri 08:00–14:00',
    wazeUrl: 'https://waze.com/ul?ll=31.77624,35.22380&navigate=yes',
    mapsUrl: 'https://maps.google.com/?q=31.77624,35.22380',
    image: '/images/branch-jerusalem.webp',
  },
  {
    nameHe: 'נתב"ג – שירות משלוח',
    nameEn: 'Ben Gurion Airport',
    addressHe: 'נמל התעופה בן גוריון',
    addressEn: 'Ben Gurion International Airport',
    phone: OFFICE_PHONE,
    hoursHe: 'שירות משלוח 24/7',
    hoursEn: '24/7 Delivery Service',
    wazeUrl: 'https://waze.com/ul?ll=32.0114,34.8858&navigate=yes',
    mapsUrl: 'https://maps.google.com/?q=32.0114,34.8858',
    image: '/images/branch-airport.webp',
  },
];

export default function BranchesSection({ locale }: { locale: string }) {
  const isHe = locale === 'he';

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`mb-12 ${isHe ? 'text-right' : 'text-left'}`}>
          <p className="text-[#E8743B] text-sm font-semibold uppercase tracking-widest mb-2">
            {isHe ? 'נקודות שירות' : 'Our Locations'}
          </p>
          <h2 className="text-4xl font-black text-[#0D2B2B]">
            {isHe ? 'הסניפים שלנו' : 'Our Branches'}
          </h2>
          <p className="text-gray-500 mt-2 max-w-xl">
            {isHe
              ? 'מגיעים אליכם בכל רחבי הארץ – 4 סניפים לשירותכם'
              : 'We come to you across the country – 4 branches at your service'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {branches.map((branch) => (
            <div
              key={branch.nameEn}
              className="group rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl hover:border-[#B8D8D8] transition-all duration-300 flex flex-col bg-white"
            >
              <div className="relative h-40 overflow-hidden bg-[#eef6f6]">
                <Image
                  src={branch.image}
                  alt={isHe ? `${branch.nameHe} – ${branch.addressHe}` : `${branch.nameEn} – ${branch.addressEn}`}
                  fill
                  loading="lazy"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
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
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#E8743B', fontWeight: 600, textDecoration: 'none' }}
                  >
                    <Phone className="w-4 h-4" style={{ flexShrink: 0 }} />
                    {branch.phone}
                  </a>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#E8743B', fontWeight: 600 }}>
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
                <div style={{ fontSize: '11px', color: '#9CA3AF', textAlign: isHe ? 'right' : 'left', overflow: 'hidden' }}>
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
