const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // Hotel-side app carries guest/staff data — cache the static app shell
  // only, never authenticated API responses. Mirrors apps/super-admin.
  runtimeCaching: [
    {
      urlPattern: /^\/api\/.*/,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'roomlink-hotel-app-shell',
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
  // apps/hotel-admin imports @roomlink/db and @roomlink/ui from outside its
  // own directory (npm workspace packages) — Next.js must be told to
  // transpile them rather than treat them as pre-built.
  transpilePackages: ['@roomlink/db', '@roomlink/ui'],
  experimental: {
    // sharp resolves its platform binary (@img/sharp-linux-x64) via a
    // require() built from process.platform/process.arch at runtime, which
    // @vercel/nft's build-time file tracer can't follow statically — it
    // never gets bundled into the deployed function, producing "Could not
    // load the sharp module using the linux-x64 runtime" in production even
    // though sharp's own JS wrapper (sharp/lib/*.js) traces and loads fine.
    // This is the documented fix for tracing gaps like this. It only
    // applies to the Pages Router page graph in this Next.js version (App
    // Router route handlers are silently skipped — see
    // node_modules/next/dist/build/collect-build-traces.js), which is why
    // the card-image route lives under src/pages/api rather than
    // src/app/api like every other route: this key must match its page
    // path exactly for the override to apply.
    outputFileTracingIncludes: {
      '/api/v1/hotel/qr-codes/code/[qrCodeId]/card-image': [
        '../../node_modules/@img/sharp-linux-x64/**/*',
        '../../node_modules/@img/sharp-libvips-linux-x64/**/*',
      ],
    },
  },
}

module.exports = withPWA(nextConfig)
