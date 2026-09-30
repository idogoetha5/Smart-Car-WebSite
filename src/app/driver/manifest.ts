import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SmartCar נהגים',
    short_name: 'SmartCar',
    description: 'אפליקציית נהגים לבדיקות רכב',
    start_url: '/driver',
    scope: '/driver',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#2D5F5F',
    lang: 'he',
    dir: 'rtl',
    icons: [
      { src: '/icons/driver-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/driver-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/driver-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/driver-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
