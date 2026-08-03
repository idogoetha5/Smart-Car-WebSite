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

/**
 * The admin area, which renders none of the public furniture: no site header
 * or footer, no WhatsApp button, no floating accessibility link. Those are
 * for customers, and on a phone they simply covered the controls.
 *
 * This does not license an inaccessible admin: it still has to work from the
 * keyboard and report itself properly to a screen reader.
 */
export function isAdminArea(pathname: string, locale: string): boolean {
  return pathname.startsWith(`/${locale}/admin`);
}

/**
 * Where the floating WhatsApp button must be hidden entirely rather than
 * just repositioned: a single vehicle page's booking form is tall enough
 * that the fixed-position button ends up sitting on top of an in-flow
 * field (the pickup/return time selects), or directly over the submit
 * button itself, depending on scroll position — confirmed at 320/390/430px.
 * Contact by WhatsApp stays reachable from the footer and contact page on
 * this route; only the floating duplicate goes away here.
 */
export function hidesFloatingWhatsApp(pathname: string, locale: string): boolean {
  return pathname.startsWith(`/${locale}/rental/`);
}
