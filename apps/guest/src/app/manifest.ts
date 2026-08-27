import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RoomLink',
    short_name: 'RoomLink',
    description: 'Contact Reception, request hotel services, order food, and track requests — right from your room.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#3763f4',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
