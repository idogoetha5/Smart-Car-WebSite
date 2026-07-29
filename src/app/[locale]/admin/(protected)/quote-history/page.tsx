'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Download,
  Eye,
  FileClock,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react';
import { useApiList } from '@/lib/swr';
import type { QuoteHistoryRow } from '@/lib/quote-history';

function formatTimestamp(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function formatBytes(value: number, locale: string) {
  if (!value) return '—';
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    style: 'unit',
    unit: 'kilobyte',
    maximumFractionDigits: 0,
  }).format(value / 1024);
}

export default function QuoteHistoryPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'he';
  const isHe = locale === 'he';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'saved' | 'sent'>('all');
  const [date, setDate] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const {
    items: quotes,
    isLoading,
    isValidating,
    mutate,
  } = useApiList<QuoteHistoryRow>('/api/admin/quotes');

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(locale);
    return quotes.filter((quote) => {
      if (status !== 'all' && quote.status !== status) return false;
      if (date && !quote.created_at.startsWith(date)) return false;
      if (!needle) return true;

      return [
        quote.quote_number,
        quote.customer_name,
        quote.customer_email,
        quote.company_name ?? '',
        quote.company_id ?? '',
        quote.vehicle_summary,
      ].some((value) => value.toLocaleLowerCase(locale).includes(needle));
    });
  }, [date, locale, quotes, search, status]);

  const resendQuote = async (quote: QuoteHistoryRow) => {
    setSendingId(quote.id);
    setNotice('');
    setErrorMessage('');

    try {
      const response = await fetch(`/api/admin/quotes/${quote.id}/send`, {
        method: 'POST',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorMessage(body.error || (isHe ? 'שליחת ההצעה נכשלה' : 'Could not send the quote'));
        return;
      }

      setNotice(
        isHe
          ? `הצעה מס׳ ${quote.quote_number} נשלחה שוב ל־${quote.customer_email}`
          : `Quote ${quote.quote_number} was sent again to ${quote.customer_email}`
      );
      await mutate();
    } catch {
      setErrorMessage(isHe ? 'לא ניתן היה לשלוח את ההצעה כרגע' : 'The quote could not be sent');
    } finally {
      setSendingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-8 space-y-4">
        <div className="h-10 w-64 rounded-xl bg-gray-200 animate-pulse" />
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-24 rounded-2xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900">
            {isHe ? 'היסטוריית הצעות מחיר' : 'Quote history'}
          </h1>
          <p className="mt-1 text-gray-500">
            {isHe
              ? `${filtered.length} מתוך ${quotes.length} הצעות`
              : `${filtered.length} of ${quotes.length} quotes`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => mutate()}
          disabled={isValidating}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} aria-hidden="true" />
          {isHe ? 'רענן' : 'Refresh'}
        </button>
      </div>

      {notice && (
        <div role="status" aria-live="polite" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </div>
      )}
      {errorMessage && (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_180px_190px]">
        <label className="relative">
          <span className="sr-only">{isHe ? 'חיפוש בהיסטוריית ההצעות' : 'Search quote history'}</span>
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={isHe ? 'שם לקוח, חברה, מייל, רכב או מספר הצעה...' : 'Customer, company, email, vehicle or quote number...'}
            className="min-h-11 w-full rounded-xl border border-gray-200 bg-white pe-10 ps-4 text-sm outline-none focus:ring-2 focus:ring-[#2D5F5F]"
          />
        </label>
        <label>
          <span className="sr-only">{isHe ? 'סינון לפי סטטוס' : 'Filter by status'}</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#2D5F5F]"
          >
            <option value="all">{isHe ? 'כל הסטטוסים' : 'All statuses'}</option>
            <option value="sent">{isHe ? 'נשלחה' : 'Sent'}</option>
            <option value="saved">{isHe ? 'נשמרה' : 'Saved'}</option>
          </select>
        </label>
        <label>
          <span className="sr-only">{isHe ? 'סינון לפי תאריך' : 'Filter by date'}</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#2D5F5F]"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-16 text-center">
            <FileClock className="mb-4 h-12 w-12 text-gray-300" aria-hidden="true" />
            <h2 className="font-bold text-gray-700">
              {quotes.length === 0
                ? (isHe ? 'עדיין אין הצעות שמורות' : 'No saved quotes yet')
                : (isHe ? 'לא נמצאו הצעות מתאימות' : 'No matching quotes')}
            </h2>
            <p className="mt-1 max-w-md text-sm text-gray-400">
              {isHe
                ? 'הצעה נשמרת אוטומטית יחד עם ה־PDF בעת הורדה או שליחה.'
                : 'A quote and its PDF are saved automatically when downloaded or sent.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-3 md:hidden">
              {filtered.map((quote) => (
                <article
                  key={quote.id}
                  className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-bold text-gray-900">
                        {quote.company_name || quote.customer_name}
                      </h2>
                      {quote.company_name && (
                        <p className="truncate text-sm text-gray-500">{quote.customer_name}</p>
                      )}
                      <p className="truncate text-xs text-gray-400">{quote.customer_email}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      quote.status === 'sent'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {quote.status === 'sent'
                        ? (isHe ? 'נשלחה' : 'Sent')
                        : (isHe ? 'נשמרה' : 'Saved')}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-gray-400">{isHe ? 'מספר הצעה' : 'Quote number'}</dt>
                      <dd className="font-semibold text-[#2D5F5F]">{quote.quote_number}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-400">{isHe ? 'תאריך' : 'Date'}</dt>
                      <dd className="text-xs text-gray-600">{formatTimestamp(quote.created_at, locale)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-gray-400">{isHe ? 'רכב' : 'Vehicle'}</dt>
                      <dd className="text-gray-700">{quote.vehicle_summary || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-400">{isHe ? 'בתוקף עד' : 'Valid until'}</dt>
                      <dd className="text-gray-600">{quote.valid_until}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-400">{isHe ? 'גודל קובץ' : 'File size'}</dt>
                      <dd className="text-gray-600">{formatBytes(quote.pdf_size, locale)}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <a
                      href={`/api/admin/quotes/${quote.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-gray-200 px-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      {isHe ? 'צפייה' : 'View'}
                    </a>
                    <a
                      href={`/api/admin/quotes/${quote.id}/pdf?download=1`}
                      className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-gray-200 px-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      {isHe ? 'הורדה' : 'Download'}
                    </a>
                    <button
                      type="button"
                      onClick={() => resendQuote(quote)}
                      disabled={sendingId !== null}
                      className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-[#2D5F5F] px-2 text-xs font-bold text-white hover:bg-[#244e4e] disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                      {sendingId === quote.id
                        ? (isHe ? 'שולח...' : 'Sending...')
                        : (isHe ? 'שליחה' : 'Send')}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[960px] text-start text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-gray-500">
                <tr>
                  <th className="p-4 font-semibold">{isHe ? 'לקוח / חברה' : 'Customer / company'}</th>
                  <th className="p-4 font-semibold">{isHe ? 'מספר הצעה' : 'Quote number'}</th>
                  <th className="p-4 font-semibold">{isHe ? 'רכב' : 'Vehicle'}</th>
                  <th className="p-4 font-semibold">{isHe ? 'תאריך' : 'Date'}</th>
                  <th className="p-4 font-semibold">{isHe ? 'סטטוס' : 'Status'}</th>
                  <th className="p-4 font-semibold">{isHe ? 'קובץ' : 'File'}</th>
                  <th className="p-4 font-semibold">{isHe ? 'פעולות' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((quote) => (
                  <tr key={quote.id} className="transition-colors hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{quote.company_name || quote.customer_name}</div>
                      {quote.company_name && <div className="text-xs text-gray-500">{quote.customer_name}</div>}
                      <div className="mt-0.5 text-xs text-gray-400">{quote.customer_email}</div>
                    </td>
                    <td className="p-4 font-semibold text-[#2D5F5F]">{quote.quote_number}</td>
                    <td className="max-w-56 p-4 text-gray-600">{quote.vehicle_summary}</td>
                    <td className="p-4 text-xs text-gray-500">
                      <div>{formatTimestamp(quote.created_at, locale)}</div>
                      <div>{isHe ? 'בתוקף עד' : 'Valid until'}: {quote.valid_until}</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                        quote.status === 'sent'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {quote.status === 'sent'
                          ? (isHe ? 'נשלחה' : 'Sent')
                          : (isHe ? 'נשמרה' : 'Saved')}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-gray-500">{formatBytes(quote.pdf_size, locale)}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/api/admin/quotes/${quote.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          {isHe ? 'צפייה' : 'View'}
                        </a>
                        <a
                          href={`/api/admin/quotes/${quote.id}/pdf?download=1`}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                          {isHe ? 'הורדה' : 'Download'}
                        </a>
                        <button
                          type="button"
                          onClick={() => resendQuote(quote)}
                          disabled={sendingId !== null}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#2D5F5F] px-3 py-2 text-xs font-bold text-white hover:bg-[#244e4e] disabled:opacity-50"
                        >
                          <Send className="h-4 w-4" aria-hidden="true" />
                          {sendingId === quote.id
                            ? (isHe ? 'שולח...' : 'Sending...')
                            : (isHe ? 'שליחה חוזרת' : 'Send again')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
