import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DeclarationCard from '@/components/admin/DeclarationCard';
import DeclarationEmailRetry from '@/components/admin/DeclarationEmailRetry';
import { verifyAdminToken } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DeclarationsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const he = locale === 'he';
  const pageValue = Number((await searchParams).page);
  const page = Number.isSafeInteger(pageValue) && pageValue >= 1 && pageValue <= 10_000 ? pageValue : 1;
  if (!await verifyAdminToken((await cookies()).get('admin_auth')?.value ?? '')) redirect('/' + locale + '/admin/login');

  const size = 30;
  const { data, error } = await createAdminClient().from('rental_declarations')
    .select('id, full_name, locale, signed_at, office_email_sent_at')
    .order('signed_at', { ascending: false }).order('id').range((page - 1) * size, page * size);
  const date = new Intl.DateTimeFormat(he ? 'he-IL' : 'en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jerusalem',
  });
  return (
    <main dir={he ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-4xl space-y-5 px-4 py-7 md:px-8">
      <h1 className="text-2xl font-bold text-slate-900">{he ? 'הצהרות חתומות' : 'Signed declarations'}</h1>
      {error && <p role="alert">{he ? 'לא ניתן לטעון את ההצהרות כרגע.' : 'Declarations could not be loaded.'}</p>}
      {data?.length === 0 && <p>{he ? 'לא נמצאו הצהרות בעמוד זה.' : 'No declarations on this page.'}</p>}
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {data?.slice(0, size).map((row) => (
          <li key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <strong className="break-words text-slate-900" dir="auto">{row.full_name}</strong>
              <p className="mt-1 text-sm text-slate-600">{date.format(new Date(row.signed_at))} · {row.locale === 'he' ? 'עברית' : 'English'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a className="inline-flex min-h-11 items-center rounded-lg bg-teal-800 px-3 text-sm font-bold text-white"
                href={'/api/admin/declarations/' + row.id} target="_blank" rel="noopener noreferrer">
                {he ? 'פתיחת טופס וחתימה' : 'Open signed PDF'}
              </a>
              <DeclarationCard id={row.id} he={he} />
              {row.office_email_sent_at
                ? <span className="text-sm text-emerald-800">{he ? 'הועבר לשירות הדיוור' : 'Accepted by email provider'}</span>
                : <DeclarationEmailRetry id={row.id} he={he} />}
            </div>
          </li>
        ))}
      </ul>
      <nav aria-label={he ? 'ניווט בין עמודים' : 'Pagination'} className="flex gap-4">
        {page > 1 && <a className="py-3 underline" href={'?page=' + (page - 1)}>{he ? 'העמוד הקודם' : 'Previous page'}</a>}
        {data && data.length > size && <a className="py-3 underline" href={'?page=' + (page + 1)}>{he ? 'העמוד הבא' : 'Next page'}</a>}
      </nav>
    </main>
  );
}
