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
    wazeUrl: 'https://waze.com/ul?ll=32.16278,34.79306&navigate=yes',
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
                <div className="absolute inset-0 bg-gradient-to-t from-[#0D2B2B]/80 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="font-bold text-white text-base drop-shadow-sm">
                    {isHe ? branch.nameHe : branch.nameEn}
                  </h3>
                </div>
              </div>

              <div className="p-4 flex flex-col gap-3 flex-1">
                <div className={`flex items-start gap-2 text-sm text-gray-600 ${isHe ? 'flex-row-reverse text-right' : ''}`}>
                  <MapPin className="w-4 h-4 text-[#2D5F5F] shrink-0 mt-0.5" />
                  <span>{isHe ? branch.addressHe : branch.addressEn}</span>
                </div>

                {branch.phone ? (
                  <a
                    href={`tel:${branch.phone}`}
                    className={`flex items-center gap-2 text-sm text-[#2D5F5F] font-semibold hover:text-[#E8743B] transition-colors ${isHe ? 'flex-row-reverse' : ''}`}
                  >
                    <Phone className="w-4 h-4 shrink-0" />
                    {branch.phone}
                  </a>
                ) : (
                  <div className={`flex items-center gap-2 text-sm text-[#E8743B] font-semibold ${isHe ? 'flex-row-reverse' : ''}`}>
                    <Clock className="w-4 h-4 shrink-0" />
                    {isHe ? 'שירות 24/7' : '24/7 Service'}
                  </div>
                )}

                <div className={`text-xs text-gray-400 ${isHe ? 'text-right' : ''}`}>
                  {isHe ? branch.hoursHe : branch.hoursEn}
                </div>

                <div className="flex gap-2 mt-auto pt-2 border-t border-gray-50">
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
