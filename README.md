# Cengo Cut

Installable, mobile-first **PWA** for one person's training: fat loss while keeping muscle —
5 morning gym sessions (+ an optional 6th), easy runs and Friday football. Dark theme, Turkish UI
(`tr-TR` dates and numbers); exercise names stay canonical English gym terms.

## Plan

`src/data/plan.json` (v2) is the single source of truth: weekly template, the five strength
sessions (sets × reps, current loads), run rules, nutrition targets, meals, supplements and sleep
rule. Screens render from it; nothing is hardcoded. Target load = last logged working weight
(before any history: the plan's `startKg`); a "+step" is suggested when the target reps were hit
at RPE ≤ 7.

## Screens

Tab bar: **Bugün** `/` · **Plan** `/plan` · **Hareketler** `/exercises` · **Geçmiş** `/history` ·
**İlerleme** `/progress`. **Ayarlar** `/settings` via the gear on Bugün. Also `/nutrition`,
`/exercises/:name` and the full-screen workout flow `/session`.

## Data

- Local-first: a zustand store persisted to `localStorage` (schema v3); progress photos in IndexedDB.
- Optional sync to a self-hosted Convex backend, enabled only when `VITE_CONVEX_URL` and
  `VITE_SYNC_SECRET` are set (e.g. in `.env.local`); without them the app is fully local.
- Garmin activities are pulled read-only from that backend and shown with their coach comment.
- Backup/restore: JSON export and import (with validation and merge) in Ayarlar.

## Stack

Vite 7 · React 19 · TypeScript (strict) · Tailwind v4 · zustand · React Router 7 · recharts
(İlerleme only) · lucide-react · vite-plugin-pwa · idb-keyval · Convex client · vitest.

## Scripts

```bash
bun install
bun run dev         # Vite dev server (+ LAN IP to install the PWA on a phone)
bun run build       # tsc -b && vite build
bun run preview     # serve the production build (service worker active)
bun run type-check  # tsc -b --noEmit
bun run lint        # eslint .
bun run test        # vitest run   (test:watch for watch mode)
```

After the first load the app shell is precached and works offline; on a phone use
"Add to Home Screen" for the standalone app.
