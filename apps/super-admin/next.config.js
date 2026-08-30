const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // Internal admin tool with sensitive data — cache the static app shell only,
  // never authenticated API responses.
  runtimeCaching: [
    {
      urlPattern: /^\/api\/.*/,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'roomlink-app-shell',
        expiration: { maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
  ],
  // Every route's JS chunk (~60-70 files) was being precached eagerly the
  // moment the service worker installed — on first login and on every
  // deploy — competing for bandwidth with the page the user actually asked
  // for. The NetworkFirst rule above already caches each chunk the first
  // time it's requested, so precaching only needs to warm the handful of
  // files every page depends on (framework/webpack/polyfills + CSS/fonts),
  // not every page in the app.
  buildExcludes: [/chunks\/app\/.*\.js$/, /chunks\/pages\/.*\.js$/],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Baked in at build time (not read from process.env at request time) so
  // every deployment shows the version it was actually built from,
  // regardless of which user is looking at it. VERCEL_GIT_COMMIT_SHA is a
  // Vercel system env var, present automatically in that build environment
  // — no project configuration needed — and empty in local dev.
  env: {
    NEXT_PUBLIC_APP_VERSION: require('./package.json').version,
    NEXT_PUBLIC_GIT_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7),
  },
  // apps/super-admin imports @roomlink/db and @roomlink/ui from outside its
  // own directory (npm workspace packages) — Next.js must be told to
  // transpile them rather than treat them as pre-built.
  transpilePackages: ['@roomlink/db', '@roomlink/ui'],
}

module.exports = withPWA(nextConfig)
