import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'he'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'he';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  if (!locale || !locales.includes(locale as Locale)) notFound();

  return {
    locale,
    messages: (await import(`./src/messages/${locale}.json`)).default,
  };
});
