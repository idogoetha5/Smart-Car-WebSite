'use client';

import { useMemo, useState } from 'react';
import { Mail, Phone, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { BRANCHES, type BranchId } from '@/lib/branches';
import { useApiList } from '@/lib/swr';

type CustomerForm = {
  id: string;
  branch_id: BranchId;
  full_name: string;
  date_of_birth: string;
  passport_number: string;
  driver_license_number: string;
  country: string;
  city: string;
  address: string;
  postal_code: string;
  phone: string;
  israel_address: string | null;
  email: string;
  locale: 'he' | 'en';
  status: 'new' | 'reviewed' | 'archived';
  invoice_notice_accepted_at: string;
  created_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.startsWith('0') ? `972${digits.slice(1)}` : digits}`;
}

export default function CustomerDetailsAdminPage() {
  const [selectedBranch, setSelectedBranch] = useState<'all' | BranchId>('all');
  const { items, isLoading, isValidating, mutate } = useApiList<CustomerForm>('/api/admin/customer-details');

  const grouped = useMemo(() => BRANCHES.map((branch) => ({
    branch,
    forms: items.filter((item) => item.branch_id === branch.id),
  })).filter((group) => selectedBranch === 'all' || group.branch.id === selectedBranch), [items, selectedBranch]);

  return (
    <div className="p-4 sm:p-8" dir="rtl">
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900">טפסי לקוחות</h1>
          <p className="mt-1 text-gray-500">{items.length} טפסים, מסודרים לפי סניף</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="branch-filter" className="sr-only">סינון לפי סניף</label>
          <select
            id="branch-filter"
            value={selectedBranch}
            onChange={(event) => setSelectedBranch(event.target.value as 'all' | BranchId)}
            className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]"
          >
            <option value="all">כל הסניפים</option>
            {BRANCHES.map((branch) => <option key={branch.id} value={branch.id}>{branch.nameHe}</option>)}
          </select>
          <button
            type="button"
            onClick={() => mutate()}
            disabled={isValidating}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} aria-hidden="true" />
            רענון
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl bg-gray-200" />)}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ branch, forms }) => (
            <section key={branch.id} aria-labelledby={`branch-${branch.id}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id={`branch-${branch.id}`} className="text-xl font-black text-[#0D2B2B]">{branch.nameHe}</h2>
                <span className="rounded-full bg-[#eef6f6] px-3 py-1 text-xs font-black text-[#2D5F5F]">{forms.length} טפסים</span>
              </div>
              {forms.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">אין טפסים בסניף זה</div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {forms.map((form) => (
                    <article key={form.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef6f6] text-[#2D5F5F]"><UserRound className="h-5 w-5" aria-hidden="true" /></div>
                          <div className="min-w-0">
                            <h3 className="truncate font-black text-gray-900">{form.full_name}</h3>
                            <p className="mt-0.5 text-xs text-gray-400">{formatDate(form.created_at)} · <span dir="ltr">{form.id}</span></p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-[#B64916]">{form.locale === 'he' ? 'עברית' : 'English'}</span>
                      </div>

                      <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
                        <div><dt className="text-xs font-bold text-gray-400">תאריך לידה</dt><dd className="mt-0.5 font-medium text-gray-800" dir="ltr">{form.date_of_birth}</dd></div>
                        <div><dt className="text-xs font-bold text-gray-400">ת״ז / דרכון</dt><dd className="mt-0.5 font-medium text-gray-800" dir="ltr">{form.passport_number}</dd></div>
                        <div><dt className="text-xs font-bold text-gray-400">רישיון נהיגה</dt><dd className="mt-0.5 font-medium text-gray-800" dir="ltr">{form.driver_license_number}</dd></div>
                        <div><dt className="text-xs font-bold text-gray-400">עיר ומדינה</dt><dd className="mt-0.5 font-medium text-gray-800">{form.city}, {form.country}</dd></div>
                        <div className="sm:col-span-2"><dt className="text-xs font-bold text-gray-400">כתובת מגורים</dt><dd className="mt-0.5 font-medium text-gray-800">{form.address}{form.postal_code ? `, ${form.postal_code}` : ''}</dd></div>
                        <div className="sm:col-span-2"><dt className="text-xs font-bold text-gray-400">כתובת בישראל</dt><dd className="mt-0.5 font-medium text-gray-800">{form.israel_address || '—'}</dd></div>
                      </dl>

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                        <a href={`tel:${form.phone}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gray-50 px-3 text-sm font-bold text-gray-700 hover:bg-gray-100"><Phone className="h-4 w-4" />{form.phone}</a>
                        <a href={waLink(form.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-green-50 px-3 text-sm font-bold text-green-700 hover:bg-green-100">WhatsApp</a>
                        <a href={`mailto:${form.email}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#eef6f6] px-3 text-sm font-bold text-[#2D5F5F] hover:bg-[#d9ecec]"><Mail className="h-4 w-4" />{form.email}</a>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs font-medium text-gray-500"><ShieldCheck className="h-4 w-4 text-[#2D5F5F]" aria-hidden="true" />אישור חשבוניות וחיובים עתידיים התקבל ב־{formatDate(form.invoice_notice_accepted_at)}</div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
