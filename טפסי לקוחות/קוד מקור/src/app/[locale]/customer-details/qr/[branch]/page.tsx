import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { BRANCHES, getBranch, type BranchId } from '@/lib/branches';
import { NOINDEX } from '@/lib/seo';

const branchIds = new Set<BranchId>(BRANCHES.map((branch) => branch.id));

export const metadata: Metadata = {
  title: 'SmartCar customer form QR',
  robots: NOINDEX,
};

export function generateStaticParams() {
  return BRANCHES.map((branch) => ({ branch: branch.id }));
}

export default async function CustomerFormQrPoster({
  params,
}: {
  params: Promise<{ locale: string; branch: string }>;
}) {
  const { branch: rawBranch } = await params;
  if (!branchIds.has(rawBranch as BranchId)) notFound();
  const branch = getBranch(rawBranch as BranchId);
  const formUrl = `https://smartcar.co.il/en/customer-details?branch=${branch.id}`;

  return (
    <div className="smartcar-qr-poster mx-auto my-8 flex min-h-[calc(100vh-4rem)] max-w-[54rem] flex-col items-center justify-between overflow-hidden rounded-[2rem] border border-[#B8D8D8] bg-white px-8 py-10 text-center shadow-2xl shadow-[#0D2B2B]/10 sm:px-16 sm:py-14">
      <div className="w-full">
        <Image src="/images/logo.png" alt="SmartCar" width={300} height={132} className="mx-auto h-auto w-52 sm:w-64" priority />
        <div className="mx-auto mt-7 h-1.5 w-20 rounded-full bg-[#E8743B]" />
        <p className="mt-6 text-lg font-black text-[#2D5F5F]">{branch.nameHe} · {branch.nameEn}</p>
        <h1 className="mt-5 text-4xl font-black leading-tight text-[#0D2B2B] sm:text-6xl">סרקו ומלאו את הפרטים</h1>
        <p className="mt-3 text-2xl font-bold text-[#2D5F5F] sm:text-3xl">Scan to complete your details</p>
      </div>

      <div className="my-8 rounded-[2rem] border-4 border-[#0D2B2B] bg-white p-4 sm:p-6">
        <Image
          src={`/images/qr-customer-details-${branch.id}.png`}
          alt={`QR code for the SmartCar ${branch.nameEn} customer form`}
          width={430}
          height={430}
          className="h-auto w-[min(68vw,27rem)]"
          priority
        />
      </div>

      <div className="w-full">
        <p className="text-xl font-bold leading-8 text-gray-700">טופס קצר, מאובטח ונוח למילוי בטלפון</p>
        <p className="mt-1 text-lg font-semibold text-gray-500">A short, secure form designed for your phone</p>
        <p className="mt-6 break-all text-sm text-gray-400" dir="ltr">{formUrl}</p>
      </div>
    </div>
  );
}
