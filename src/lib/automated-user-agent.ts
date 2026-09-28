// Performance analytics describe real visitor experience. Crawlers neither
// represent that experience nor need to execute third-party measurement code;
// some (notably Baiduspider-render) also use JavaScript parsers that cannot
// parse Vercel's current Speed Insights bundle.
const AUTOMATED_USER_AGENT =
  /(?:bot|crawler|spider|crawling|slurp|bingpreview|headlesschrome|lighthouse|pagespeed|facebookexternalhit|whatsapp)/i;

export function isAutomatedUserAgent(userAgent: string): boolean {
  return AUTOMATED_USER_AGENT.test(userAgent);
}
