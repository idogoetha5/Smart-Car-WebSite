/**
 * Web-app manifest for the branch managers' app, so it installs to the home
 * screen (phone) or as an app (computer) and opens straight on the manager
 * board. Served under /driver/manifest* so src/proxy.ts lets it through
 * without a login, like the drivers' manifest.
 */
export function GET() {
  const manifest = {
    name: 'SmartCar מנהלים',
    short_name: 'SmartCar מנהלים',
    description: 'הקצאת משימות לנהגים ומעקב',
    start_url: '/driver/manage',
    scope: '/driver/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    lang: 'he',
    dir: 'rtl',
    icons: [
      { src: '/icons/driver-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/driver-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/driver-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/driver-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' },
  });
}
