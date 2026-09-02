# Tuition Admin Console (web)

A desktop admin interface for the existing Tuition Marketplace platform. It is a
**second frontend client of the same backend** — the same API, the same database,
the same JWT auth and the same `authorize('admin')` rules as the mobile admin
app. No admin logic, storage or business rule is duplicated here.

```
                    Existing Backend API (backend/)
                              │
              ┌───────────────┴───────────────┐
              │                               │
      tuition-mobile (Expo)            admin-web (this app)
              │                               │
              └───────────────┬───────────────┘
                              │
                      Existing MongoDB
```

## Stack

React 19 · Vite 6 · TypeScript · React Router 7 · TanStack Query 5 · Recharts.
TanStack Query and React 19 match the versions already used by `tuition-mobile`.
Styling is plain CSS with design tokens copied from `tuition-mobile/src/theme`.

## Getting started

```bash
cd admin-web
npm install
cp .env.example .env        # then set VITE_API_URL
npm run dev                 # http://localhost:5173
```

`.env`:

```
VITE_API_URL=http://localhost:5000/api     # or https://hometuitionapp.com/api
VITE_ENVIRONMENT=development
```

`VITE_API_URL` must include the `/api` suffix — it is the same base URL
`tuition-mobile/src/config/api.ts` uses.

### CORS

The backend allowlists origins in `src/index.ts` via `getAllowedOrigins()`, which
is environment-driven. **No backend code change is required.**

In production the console is served from `https://hometuitionapp.com/admin`, i.e.
the *same origin* as the API — so no CORS entry is needed there at all.

For local development against the production API, add the dev origin:

```bash
DEV_ORIGINS=http://localhost:5173
```

(The mobile app is unaffected either way: native requests send no `Origin`
header, which `getAllowedOrigins()` already allows.)

## Commands

```bash
npm run dev         # dev server
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # typecheck + production build to dist/
npm run preview     # serve the built bundle
```

`npm run build` outputs a static `dist/`.

### Production serving

The console is served at **`https://hometuitionapp.com/admin`** by the same nginx
that fronts the API, from `/var/www/admin-web`. Because it lives under a path
rather than at a domain root:

- `vite.config.ts` sets `base: '/admin/'` so emitted asset URLs are prefixed.
- `App.tsx` passes that same value to `<BrowserRouter basename>` via
  `import.meta.env.BASE_URL`, so routes resolve under `/admin`.

Moving the console to its own subdomain later means setting `base: '/'` and
rebuilding — nothing else in the app changes.

The app uses client-side routing, so nginx rewrites unknown paths under `/admin`
to `index.html`.

## Authentication

- `POST /api/auth/login` with `{ emailOrMobile, password }` — the platform's
  existing credential login. No admin-specific endpoint was added.
- The returned JWT is kept in `localStorage` and sent as `Authorization: Bearer`.
- On load the session is re-validated against `GET /api/auth/me`; a role other
  than `admin` ends the session.
- Any `401` from any endpoint clears the session and returns to `/login` with a
  "session expired" notice.
- Credentials are never hard-coded, and no secret is stored in the bundle.

## Permissions

`authorize('admin')` on the backend is the only real gate, and it is unchanged.
`User.permissions` (a free-form `string[]` that the backend does not enforce) is
read here purely to narrow the menu: an admin with an empty list sees every
section; one with a list sees only what it names. A hidden route still returns
`403` from the server if reached directly.

## Layout

```
src/
├── api/          client.ts + one module per domain (auth, users, courses, finance, operations, notifications)
├── auth/         AuthContext, route guards, permission helpers
├── components/   ui/ (design system) and common/ (states, toolbars, filters)
├── config/       env.ts
├── hooks/        debounce, URL-backed list params, dismissable popovers
├── layouts/      admin shell: sidebar, header, notification drawer, nav map
├── pages/        one folder per section
├── routes/       lazy route table
├── types/        response types mirrored from the backend
└── utils/        formatting and shared constants
```

## Notes on the marketplace

Course lessons are a flat, ordered array on the `Course` document — there is no
`Section` model, so the content manager presents ordered lessons rather than
inventing a section layer. Reordering writes the new `order` values back through
the lesson update endpoint; nothing is ordered client-side only.

Lesson videos upload through
`POST /api/admin/courses/:courseId/lessons/:lessonId/video` (multipart, field
name `video`) into the platform's existing S3 storage. Previews use the
short-lived signed URL the backend generates — the same mechanism the parent app
uses for playback. No storage credential reaches the browser.

Course categories are a fixed constant, mirrored from
`tuition-mobile/src/constants/courseCategories.ts` into
`src/utils/constants.ts`. Changing one without the other would desynchronise
stored `categoryId` values.
