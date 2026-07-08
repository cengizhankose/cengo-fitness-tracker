# Cengo Cut

Mobile-first, installable **PWA** fitness tracker for the *Cengo Cut + Marathon Hybrid Plan*
(92kg→82-84kg cut + 12-week Istanbul Marathon block). Dark, aggressive, motivational UI.

Local-first — **no backend**. Structured data persists to `localStorage`; progress photos to
`IndexedDB`. The training/nutrition plan in `src/data/plan.json` is the single source of truth;
the UI renders entirely from it (nothing hardcoded).

## Stack

Vite 7 · React 19 · TypeScript (strict) · Tailwind v4 · Zustand · React Router 7 · recharts ·
lucide-react · vite-plugin-pwa · idb-keyval.

## Commands

```bash
bun install
bun run dev        # http://localhost:5175  (+ LAN IP, to install the PWA on your phone)
bun run build      # tsc -b && vite build
bun run preview    # serve the production build (service worker active)
bun run type-check
bun run lint
```

## Offline / install

After the first load, the app shell is precached and works fully offline (the plan JSON is
bundled). On a phone, open the LAN URL and "Add to Home Screen" for a fullscreen standalone app.

## Credits

Mobility/stretch exercise reference images in `public/exercises/` are from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense / everkinetic imagery).
