import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Car, CarFront, Van, Truck, Crown, Clock } from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'he' ? 'אודות' : 'About',
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isHe = locale === 'he';

  return (
    <div dir={isHe ? 'rtl' : 'ltr'} className="min-h-screen">

      {/* Hero */}
      <div className="bg-[#0D2B2B] py-14 md:py-24 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <Image
            src="/images/cars-fleet.jpg"
            alt="SmartCar fleet overview"
            fill
            className="object-cover"
          />
        </div>
        <div className="relative z-10">
          <p className="text-[#E8743B] font-medium mb-3 tracking-widest text-sm">
            {isHe ? 'הסיפור שלנו' : 'Our Story'}
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
            SMART<span className="text-[#E8743B]">CAR</span>
          </h1>
          <p className="text-[#B8D8D8] text-xl max-w-2xl mx-auto leading-relaxed">
            {isHe
              ? 'ניסיון, שירות ומקצוענות - מאז 2003'
              : 'More than a car rental company — experience, service and expertise since 2003'}
          </p>
        </div>
      </div>

      {/* Founder Story */}
      <div className="bg-white py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

            {/* Text */}
            <div className="text-start">
              <p className="text-[#E8743B] font-medium mb-2 tracking-wide text-sm">
                {isHe ? 'המייסדת' : 'The Founder'}
              </p>
              <h2 className="text-3xl font-bold text-[#0D2B2B] mb-6">
                {isHe ? 'ליליאנה נרדאה' : 'Liliana Nardea'}
              </h2>
              <p className="text-gray-600 leading-relaxed text-lg mb-4">
                {isHe
                  ? 'SmartCar היא סיפור של ניסיון, שירות ומקצוענות. החברה הוקמה בשנת 2003 על ידי ליליאנה נרדאה, מהנשים הראשונות בענף ההשכרה בישראל, עם ניסיון עשיר של מעל 30 שנה בתחום והרבה תשוקה לחדש, לדייק ולהוביל.'
                  : 'SmartCar is a story of experience, service, and expertise. Founded in 2003 by Liliana Nardea — one of the first women to lead a car rental company in Israel — SmartCar was built on over 30 years of industry knowledge and a genuine passion for innovation, precision, and leadership.'}
              </p>
              <p className="text-gray-600 leading-relaxed text-lg">
                {isHe
                  ? 'מהיום הראשון ועד היום, אנחנו ב-SmartCar שמים אתכם הלקוחות במרכז. בין אם אתם לקוחות פרטיים, עסקיים, תיירים או משפחות — אנחנו יודעים להתאים עבורכם את חבילת ההשכרה המשתלמת ביותר.'
                  : 'From day one, SmartCar has placed the customer at the center of everything we do. Whether you are a private individual, a business, a tourist, or a family — we tailor the most cost-effective rental package to your exact needs, with the personal service that keeps our customers coming back.'}
              </p>
            </div>

            {/* About image */}
            <div className="relative">
              <div className="relative rounded-3xl overflow-hidden shadow-xl" style={{ minHeight: '350px' }}>
                <Image
                  src="/images/about-image.png"
                  alt="Liliana Nardea, SmartCar founder"
                  fill
                  className="object-cover rounded-3xl"
                />
              </div>
              <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-[#E8743B] rounded-2xl opacity-20" />
            </div>
          </div>
        </div>
      </div>

      {/* Values */}
      <div className="bg-gray-50 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[#E8743B] font-medium mb-2 text-sm tracking-wide">
              {isHe ? 'מה מניע אותנו' : 'What drives us'}
            </p>
            <h2 className="text-3xl font-bold text-[#0D2B2B]">
              {isHe ? 'הערכים שלנו' : 'Our Values'}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-12 h-12 mx-auto mb-4">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                ),
                title: isHe ? 'בטיחות ואמינות' : 'Safety & Reliability',
                desc: isHe
                  ? 'אנחנו לא מתפשרים על בטיחות ותחזוקה - כדי שתוכלו לנהוג בראש שקט'
                  : 'We never compromise on safety or maintenance — every vehicle is road-ready so you can drive with complete confidence',
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-12 h-12 mx-auto mb-4">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                ),
                title: isHe ? 'שירות אישי' : 'Personal Service',
                desc: isHe
                  ? 'צוות מקצועי, מסור וזמין תמיד לכל שאלה או בקשה - כי אתם במרכז'
                  : 'A professional, dedicated team always available — because your satisfaction is not just a priority, it is our standard',
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-12 h-12 mx-auto mb-4">
                    <circle cx="12" cy="8" r="6"/>
                    <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                  </svg>
                ),
                title: isHe ? 'מקצוענות' : 'Professionalism',
                desc: isHe
                  ? 'מעל 30 שנות ניסיון בענף עם תשוקה לחדש, לדייק ולהוביל'
                  : 'Over 30 years of industry experience, with the drive to keep innovating, setting new standards, and leading the market',
              },
            ].map((v) => (
              <div key={v.title} className="bg-white rounded-2xl p-8 text-center shadow-sm hover:shadow-md transition-shadow">
                {v.icon}
                <h3 className="text-xl font-bold text-[#0D2B2B] mb-3">{v.title}</h3>
                <p className="text-gray-500 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full story */}
      <div className="bg-white py-20 px-6">
        <div className="max-w-3xl mx-auto text-start">
          <p className="text-[#E8743B] font-medium mb-2 text-sm tracking-wide text-center">
            {isHe ? 'הצוות שלנו' : 'Our Team'}
          </p>
          <h2 className="text-3xl font-bold text-[#0D2B2B] mb-8 text-center">
            {isHe ? 'אנשים שאוהבים מה שהם עושים' : 'People who love what they do'}
          </h2>
          <p className="text-gray-600 leading-loose text-lg mb-6">
            {isHe
              ? 'צוות העובדים שלנו מקצועי, מסור וזמין תמיד לכל שאלה או בקשה. אנחנו לא מתפשרים על בטיחות, אמינות ותחזוקה — כדי שתוכלו לנהוג בראש שקט.'
              : 'Our team is professional, dedicated, and always available for every question or request. We never cut corners on safety, reliability, or maintenance — because you deserve to drive with peace of mind.'}
          </p>
          <p className="text-gray-600 leading-loose text-lg mb-6">
            {isHe
              ? 'ברשותנו מגוון רחב של רכבים שיתאימו לכל צורך: רכבים משפחתיים, קומפקטיים, רכבי מיני-וואן, מסחריים ואפילו רכבי יוקרה — הכל כדי שתוכלו לבחור את מה שמתאים לכם באמת.'
              : 'Our fleet spans every category: family saloons, compact city cars, mini-vans, commercial vehicles, and luxury models — because the right vehicle makes every journey better.'}
          </p>
          <p className="text-gray-600 leading-loose text-lg">
            {isHe
              ? 'תוך הקפדה על שירות אישי, מהיר ואמין שיגרום לכם לחזור שוב ושוב.'
              : 'All backed by the personal, responsive service that has kept our customers coming back for over two decades.'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-[#0D2B2B] py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { number: '20+',  label: isHe ? 'שנות ניסיון' : 'Years of Experience' },
              { number: '4',    label: isHe ? 'סניפים ברחבי הארץ' : 'Locations Nationwide' },
              { number: '400+', label: isHe ? 'רכבים בצי' : 'Fleet Vehicles' },
              { number: '24/7', label: isHe ? 'שירות ותמיכה' : 'Service & Support' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-4xl md:text-5xl font-bold text-[#E8743B] mb-2">{stat.number}</p>
                <p className="text-[#B8D8D8] text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fleet types */}
      <div className="bg-gray-50 py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[#E8743B] font-medium mb-2 text-sm tracking-wide">
            {isHe ? 'הצי שלנו' : 'Our Fleet'}
          </p>
          <h2 className="text-3xl font-bold text-[#0D2B2B] mb-4">
            {isHe ? 'רכב לכל צורך' : 'A vehicle for every need'}
          </h2>
          <p className="text-gray-500 mb-10 text-lg">
            {isHe
              ? 'מקומפקטי ועד יוקרה - אנחנו מתאימים את הרכב הנכון עבורכם'
              : 'From compact to luxury — we match you with the right vehicle, every time'}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: <Car    className="w-10 h-10 mx-auto mb-3 text-[#2D5F5F]" strokeWidth={1.5}/>, label: isHe ? 'רכבים קומפקטיים' : 'Compact Cars' },
              { icon: <CarFront className="w-10 h-10 mx-auto mb-3 text-[#2D5F5F]" strokeWidth={1.5}/>, label: isHe ? 'רכבים משפחתיים' : 'Family Cars' },
              { icon: <Van    className="w-10 h-10 mx-auto mb-3 text-[#2D5F5F]" strokeWidth={1.5}/>, label: isHe ? 'מיני-וואן' : 'Mini-Van' },
              { icon: <Truck  className="w-10 h-10 mx-auto mb-3 text-[#2D5F5F]" strokeWidth={1.5}/>, label: isHe ? 'רכבים מסחריים' : 'Commercial Vehicles' },
              { icon: <Crown  className="w-10 h-10 mx-auto mb-3 text-[#2D5F5F]" strokeWidth={1.5}/>, label: isHe ? 'רכבי יוקרה' : 'Luxury Cars' },
              { icon: <Clock  className="w-10 h-10 mx-auto mb-3 text-[#2D5F5F]" strokeWidth={1.5}/>, label: isHe ? 'השכרה לפי שעה' : 'Hourly Rental' },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                {item.icon}
                <p className="font-semibold text-[#0D2B2B]">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-[#E8743B] py-16 px-6 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">
          {isHe ? 'מוכנים להתחיל?' : 'Ready to get started?'}
        </h2>
        <p className="text-orange-100 mb-8 text-lg">
          {isHe
            ? 'הצטרפו לאלפי לקוחות מרוצים שבוחרים ב-SmartCar'
            : 'Join thousands of satisfied customers who choose SmartCar for every journey'}
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href={`/${locale}/rental`}
            className="bg-white text-[#E8743B] font-bold px-8 py-4 rounded-xl hover:bg-gray-100 transition-colors"
          >
            {isHe ? 'השכר רכב עכשיו' : 'Book a Vehicle'}
          </Link>
          <Link
            href={`/${locale}/contact`}
            className="border-2 border-white text-white font-bold px-8 py-4 rounded-xl hover:bg-white hover:text-[#E8743B] transition-colors"
          >
            {isHe ? 'צור קשר' : 'Contact Us'}
          </Link>
        </div>
      </div>

    </div>
  );
}
