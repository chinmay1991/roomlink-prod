# Deploying RoomLink to Vercel

This repo is an npm workspace monorepo with **three separate Next.js apps**
(`apps/super-admin`, `apps/hotel-admin`, `apps/guest`), each its own product surface, sharing
one Prisma schema (`packages/db`) and one Postgres database. On Vercel that means **three
separate Vercel projects**, all pointed at the same database, each with its own Root Directory
and its own environment variables.

If you haven't moved the database to Supabase (or another reachable Postgres) yet, do that
first — see `docs/deployment/supabase-migration.md`. Vercel's build servers can't reach
`localhost:5432`, so production deploys need a real, internet-reachable `DATABASE_URL` before
any of this works.

---

## 0. Prerequisites

- [ ] A [Vercel account](https://vercel.com) (free tier is fine to start).
- [ ] A reachable Postgres database with the schema already migrated (Supabase steps 1–4 in
      `supabase-migration.md`, including the two views in step 8a).
- [ ] A GitHub (or GitLab/Bitbucket) repo to deploy from — **this project isn't a git repo yet**
      (checked: no `.git` directory). Set that up first:

```bash
git init
git add .
git commit -m "Initial commit"
```

Then create an empty repo on GitHub and push:

```bash
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main
```

You *can* deploy straight from your machine with the Vercel CLI without git (`vercel --prod`),
but connecting a git repo gets you automatic deployments on push and PR preview deployments,
which is worth it for a 3-app monorepo. The steps below assume a connected git repo; CLI-only
alternatives are noted where relevant.

- [ ] `.env` files are already git-ignored in every app and in `packages/db` (confirmed in
      `supabase-migration.md`) — never commit real secrets. Double-check with `git status` after
      your first `git add` before pushing.

---

## 1. Fix the Prisma-in-a-monorepo build gotcha (do this first)

`@prisma/client` is a dependency of all three apps, but nothing in this repo currently runs
`prisma generate` automatically during install/build — `packages/db/package.json` only exposes
it as a manual `generate` script. Locally this is masked because you've likely already run it
by hand. On a fresh Vercel build (fresh `npm install`, no prior generate), the build will fail
with something like:

```
Error: @prisma/client did not initialize yet. Please run "prisma generate"
```

Fix it once at the repo root so every app's build picks it up automatically:

```json
// package.json (repo root) — add this key
"scripts": {
  "postinstall": "npm run generate -w @roomlink/db",
  ...
}
```

Vercel always runs `npm install` at the monorepo root first (it detects the npm workspaces
config), so a root `postinstall` fires before any app's `next build` runs, regardless of which
app's project you're building.

---

## 2. Create three Vercel projects

Go to [vercel.com/new](https://vercel.com/new), import the same git repo **three times** — once
per app. For each import, Vercel asks for a Root Directory; this is what separates the three
projects:

| Vercel project name    | Root Directory       | Port used locally |
|-------------------------|-----------------------|--------------------|
| `roomlink-super-admin`  | `apps/super-admin`    | 3000               |
| `roomlink-hotel-admin`  | `apps/hotel-admin`    | 3001               |
| `roomlink-guest`        | `apps/guest`          | 3002               |

For each project, in the import screen (or later under **Settings → General**):

1. **Framework Preset**: Next.js (auto-detected).
2. **Root Directory**: set as in the table above.
3. Expand **Build and Output Settings** → enable **"Include source files outside of the Root
   Directory in the Build Step"**. This is required — without it, Vercel won't upload
   `packages/db` and `packages/ui`, and the workspace-linked `@roomlink/db` / `@roomlink/ui`
   imports will fail to resolve.
4. Leave Build Command / Install Command as the detected defaults (Vercel's npm-workspaces
   detection handles install at the root and build inside the Root Directory automatically).

Repeat for all three apps.

---

## 3. Set environment variables (per project)

Environment variables are **not shared** across separate Vercel projects — set each of these
under **Settings → Environment Variables** for the matching project, for both Production and
Preview environments.

### `roomlink-super-admin`

| Key | Value |
|---|---|
| `DATABASE_URL` | Your Supabase connection string (see note on pooling below) |
| `NEXTAUTH_URL` | `https://<your-super-admin-domain>` |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` — **different from local**, keep secret |
| `HOTEL_ADMIN_APP_URL` | `https://<your-hotel-admin-domain>` — linked from Hotel Admin invite/reset emails |
| `RESEND_API_KEY` | **Not yet set up anywhere (local or prod) — TODO.** Until then, invite/reset emails just log to the server console instead of sending; new Hotel Admins get their temp password only via the wizard's on-screen success step. To wire it up: create a Resend account, verify a sending domain (DNS records at your registrar), generate an API key, and set it here. |
| `RESEND_FROM_EMAIL` | **TODO, pairs with the above** — the verified sender address (e.g. `invites@yourdomain.com`) |

### `roomlink-hotel-admin`

| Key | Value |
|---|---|
| `DATABASE_URL` | Same Supabase connection string as above |
| `NEXTAUTH_URL` | `https://<your-hotel-admin-domain>` |
| `NEXTAUTH_SECRET` | A **different** random secret than super-admin's |
| `NEXT_PUBLIC_APP_URL` | The **guest app's** production URL, e.g. `https://roomlink-guest.vercel.app` or your custom domain — **not** hotel-admin's own URL. Every room QR code is generated as `${NEXT_PUBLIC_APP_URL}/r/<code>`; QR generation fails with a clear config error (not a crash) if this is unset. Required in both Production and Preview. |
| `NEXT_PUBLIC_ZEGOCLOUD_APP_ID` | Your ZegoCloud project's App ID (numeric). Safe to expose client-side — the Call Invitation UIKit needs it in the browser. Must match `roomlink-guest`'s value below (same ZegoCloud project on both sides). |
| `ZEGOCLOUD_SERVER_SECRET` | Your ZegoCloud project's 32-character server secret, from the same project as the App ID above. **Server-only** — never expose this with a `NEXT_PUBLIC_` prefix. Used to sign per-call tokens (`src/server/zego-token.ts`); voice-call token routes throw a clear config error if either this or the App ID is missing. |

**Preview caveat for `NEXT_PUBLIC_APP_URL`:** Vercel Preview URLs are per-deploy and dynamic, so
a hotel-admin Preview build can't automatically know a matching guest Preview URL. Point
Preview's `NEXT_PUBLIC_APP_URL` at guest **Production** for manual QR testing, unless you're
maintaining a stable guest Preview alias.

### `roomlink-guest`

| Key | Value |
|---|---|
| `DATABASE_URL` | Same Supabase connection string as above |
| `NEXT_PUBLIC_ZEGOCLOUD_APP_ID` | Same ZegoCloud App ID as `roomlink-hotel-admin`'s — guest and reception must be on the same ZegoCloud project for calls to reach each other. |
| `ZEGOCLOUD_SERVER_SECRET` | Same ZegoCloud server secret as `roomlink-hotel-admin`'s. Server-only. |

All three `DATABASE_URL` values must point at the **same** database — same "one database,
several apps" architecture this repo already uses locally.

**ZegoCloud console setup (do this before testing voice calls):** an App ID + server secret
alone aren't enough. **In-app Chat (ZIM)** must be explicitly enabled for your project in the
ZegoCloud Admin Console — the Call Invitation feature (`apps/guest`'s "Call Reception" button,
`apps/hotel-admin`'s `voice-call-listener.tsx`) is built on ZIM's signaling, not just the base
Voice/Video Call service you get by default. Without it, `sendCallInvitation()` fails silently
from the guest side with no error surfaced to the user, and Reception never sees an incoming
call — this took real debugging to track down (confirmed via ZegoCloud's own
`QueryUserOnlineState` server API returning `"app is not configured with a online environment"`)
before finding the missing console toggle.

**Connection pooling matters here.** `supabase-migration.md` intentionally used the *direct*
connection (port `5432`) because the apps ran as long-lived local Node processes. Vercel
functions are short-lived/serverless, so use the **pooled** connection instead to avoid "too
many connections" errors under load:

```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?sslmode=require&pgbouncer=true
```

(Port `6543`, `pgbouncer=true` appended.) Grab this from Supabase's **Connection pooling**
string, not the direct one, when setting `DATABASE_URL` in Vercel specifically.

**`NEXTAUTH_URL` chicken-and-egg:** you won't know the final URL until after the first deploy.
Do an initial deploy with a placeholder or the auto-assigned `*.vercel.app` domain, then update
`NEXTAUTH_URL` once you know the real domain (custom domain or the assigned one) and redeploy.
Preview deployments get random per-PR URLs that won't match `NEXTAUTH_URL` — NextAuth login will
break on previews unless you also handle `VERCEL_URL` in code; fine to ignore for now if you
only care about Production working.

---

## 4. Deploy

With git connected, pushing to `main` deploys all three projects automatically (each watches the
same repo but only rebuilds when files under its own Root Directory — or shared `packages/*` —
change). For the very first deploy, just click **Deploy** in each project's dashboard.

CLI alternative (no git required), run once per app:

```bash
cd apps/super-admin && vercel --prod
cd apps/hotel-admin && vercel --prod
cd apps/guest && vercel --prod
```

---

## 5. Verify

For each of the three deployed URLs:

1. Load the app — confirm it renders (not a 500 from a missing `DATABASE_URL` or un-generated
   Prisma client).
2. For `super-admin` and `hotel-admin`: log in with a seeded account, confirm NextAuth
   redirects work (this is where a stale `NEXTAUTH_URL` shows up as a redirect loop or
   "callback URL mismatch").
3. For `super-admin` specifically: open the dashboard and confirm the KPI widgets load — this is
   what breaks first if the `v_platform_kpis` / `v_hotel_onboarding_progress` views (step 8a of
   `supabase-migration.md`) weren't created against the production database.
4. Check **Vercel → Project → Deployments → [latest] → Functions** logs if anything 500s, to see
   the actual Prisma/DB error rather than guessing.

---

## 6. Ongoing: schema changes

`prisma migrate deploy` is **not** run automatically by Vercel's build — it only runs
`next build`. After adding a new migration, apply it to the production database yourself before
(or right after) deploying the code that depends on it:

```bash
cd packages/db
DATABASE_URL="<production direct connection, port 5432>" npx prisma migrate deploy
```

Use the **direct** (port 5432) connection for this command specifically — `migrate deploy` needs
DDL rights that the pooled connection doesn't support, same caveat as in
`supabase-migration.md`.
