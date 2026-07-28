/**
 * Strips personal data out of Sentry events before they leave the browser or
 * the server.
 *
 * This is not belt-and-braces. The booking confirmation page carries the full
 * booking id, the customer's pickup/return dates and the vehicle in its query
 * string, and the newsletter unsubscribe route still takes a raw address. An
 * error raised on any of those pages would otherwise hand that query string to
 * a third party, which is precisely the exposure the audit flagged.
 *
 * So the rule here is deliberately blunt: no query string ever ships. The path
 * is what actually identifies the broken route; the parameters only ever add
 * personal data.
 */
import type { ErrorEvent } from '@sentry/nextjs';

const SENSITIVE_HEADERS = ['cookie', 'authorization', 'referer', 'x-forwarded-for'];

/** Keeps origin + pathname, drops query and fragment. */
export function stripUrl(url: string): string {
  try {
    const parsed = new URL(url, 'https://www.smartcar.co.il');
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    // Relative or malformed — cut at the first delimiter rather than give up.
    return url.split(/[?#]/)[0];
  }
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    if (event.request.url) event.request.url = stripUrl(event.request.url);
    delete event.request.query_string;
    delete event.request.data;
    delete event.request.cookies;

    if (event.request.headers) {
      for (const name of Object.keys(event.request.headers)) {
        if (SENSITIVE_HEADERS.includes(name.toLowerCase())) {
          delete event.request.headers[name];
        }
      }
    }
  }

  // Navigation breadcrumbs record the URLs the user moved between, so they
  // carry the same query strings the request URL does.
  event.breadcrumbs = event.breadcrumbs?.map((crumb) => {
    if (!crumb.data) return crumb;
    const data = { ...crumb.data };
    for (const key of ['url', 'from', 'to']) {
      if (typeof data[key] === 'string') data[key] = stripUrl(data[key]);
    }
    return { ...crumb, data };
  });

  return event;
}
