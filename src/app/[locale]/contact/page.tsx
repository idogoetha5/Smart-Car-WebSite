import { getTranslations } from 'next-intl/server';
import { Mail, MapPin, Clock } from 'lucide-react';
import BranchesSection from '@/components/layout/BranchesSection';
import ContactForm from '@/components/contact/ContactForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'nav' });
  const isHe = locale === 'he';
  return {
    title: t('contact'),
    description: isHe
      ? 'צרו קשר עם SmartCar – חייגו 09-9509757, שלחו וואטסאפ או מייל לoffice@smartcar.co.il. נציג יחזור אליכם תוך שעה בשעות הפעילות א׳–ה׳ 8:00–20:00.'
      : 'Contact SmartCar – call 09-9509757, WhatsApp or email office@smartcar.co.il. A representative will respond within one hour, Sun–Thu 8:00–20:00.',
    alternates: { canonical: `/${locale}/contact` },
  };
}

function WhatsAppIcon() {
  return (
    <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isHe = locale === 'he';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-14">
        <h1 className="text-4xl font-black text-gray-900 mb-4">
          {isHe ? 'צור קשר' : "We're Here to Help"}
        </h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto">
          {isHe
            ? 'אנחנו כאן לכל שאלה, פנייה או בקשה. צרו קשר ונחזור אליכם בהקדם'
            : 'Have a question, a special request, or need assistance? Our team is ready — reach out and we will get back to you promptly.'}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-12">
        {/* Contact Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            {isHe ? 'שלח לנו הודעה' : 'Send Us a Message'}
          </h2>
          <ContactForm isHe={isHe} />
        </div>

        {/* Contact Info */}
        <div className="space-y-4">
          {/* Phone + WhatsApp */}
          <div className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 fill-[#1B4D3E]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800 mb-2">
                {isHe ? 'טלפון' : 'Phone'}
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="tel:09-9509757"
                  className="text-[#1B4D3E] font-semibold text-sm hover:underline"
                >
                  09-9509757
                </a>
                <a
                  href="https://wa.me/97299509757"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#25D366] text-white text-xs font-semibold rounded-full hover:bg-[#1eb755] transition-colors"
                >
                  <WhatsAppIcon />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-[#1B4D3E]" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">
                {isHe ? 'דוא"ל' : 'Email'}
              </h3>
              <a
                href="mailto:office@smartcar.co.il"
                className="text-gray-500 text-sm hover:text-[#1B4D3E] transition-colors"
              >
                office@smartcar.co.il
              </a>
            </div>
          </div>

          {/* Address */}
          <div className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-[#1B4D3E]" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">
                {isHe ? 'כתובת ראשית' : 'Main Address'}
              </h3>
              <p className="text-gray-500 text-sm">
                {isHe
                  ? 'רחוב רמת ים 122 (מלון דן אכדיה), הרצליה'
                  : '122 Ramat Yam St (Dan Accadia Hotel), Herzliya'}
              </p>
            </div>
          </div>

          {/* Hours */}
          <div className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-[#1B4D3E]" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">
                {isHe ? 'שעות פעילות' : 'Opening Hours'}
              </h3>
              <p className="text-gray-500 text-sm">
                {isHe
                  ? 'ראשון–חמישי 08:00–20:00 | שישי 08:00–14:00'
                  : 'Sun–Thu 08:00–20:00 | Fri 08:00–14:00'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="-mx-4 sm:-mx-6 lg:-mx-8 mt-4">
        <BranchesSection locale={locale} />
      </div>
    </div>
  );
}
