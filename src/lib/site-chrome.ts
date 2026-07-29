/**
 * Which routes deliberately render without the site header.
 *
 * Two things depend on this answer and must never disagree: the header
 * itself, and the floating accessibility button, which sits under the
 * header where there is one and at the top edge where there is not. Keeping
 * the rule in one place is what stops the button from drifting into the
 * logo the next time a route is added to the list.
 *
 * A single vehicle page is one task — the booking form — and carries its own
 * way back. The admin area has its own sidebar.
 */
export function hidesSiteHeader(pathname: string, locale: string): boolean {
  // Note the trailing slash: /<locale>/rental is the listing and keeps the
  // header; only /<locale>/rental/<id> loses it.
  return (
    pathname.startsWith(`/${locale}/rental/`) ||
    pathname.startsWith(`/${locale}/admin`)
  );
}
