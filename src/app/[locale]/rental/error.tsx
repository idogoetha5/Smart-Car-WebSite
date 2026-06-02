'use client';

import { useParams } from 'next/navigation';

export default function RentalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const isHe = (params?.locale as string) === 'he';

  return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <p className="text-gray-500 text-xl mb-6">
        {isHe ? 'לא ניתן לטעון את הרכב, נסה שנית' : 'Unable to load vehicle, please try again'}
      </p>
      <button
        onClick={reset}
        className="bg-[#2D5F5F] hover:bg-[#1A3A3A] text-white px-6 py-2.5 rounded-xl font-semibold transition-colors"
      >
        {isHe ? 'נסה שנית' : 'Try again'}
      </button>
    </div>
  );
}
