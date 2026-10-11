# CLAUDE.md

Public website for the ACDerby roller derby league. Vite + React 19 + TypeScript SPA in the repo root,
Azure Functions v4 API in `api/`, both hosted on Azure Static Web Apps. Cosmos DB holds content, blob storage
holds photos.

## Commands
- Frontend (repo root): `npm run dev` (port 4000), `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
- API (`api/`): `npm run build`, `npm run start` (runs `func start`), `npm run typecheck`
- Full stack locally: `npm run dev` in one terminal, then `swa start http://localhost:4000 --api-location api`

## Rules
- Every API endpoint that writes data must call `requireRole` from `api/src/shared/guard.ts` and have a test
  in `guard.test.ts` or next to the endpoint showing that a non-editor gets 403. No exceptions.
- Client-side checks (`src/auth/session.ts`) only control what is shown. They are not security.
- Roles come only from the app's `users` container, keyed by GitHub `identityProvider` + `userId`. Never trust
  roles a client sends in a body, query or its own token.
- Never commit secrets. Connection strings and keys belong in app settings or `api/local.settings.json`
  (gitignored). `.env` files are not used.
- Hooks in `.claude/` enforce these rules; they are changed by a person, not by the agent.
- Commit small, reviewable steps on a feature branch. Do not push to `main`.

## Stack and conventions
- React 19, React Router 7 (`createBrowserRouter`, import from `react-router`), react-bootstrap for UI.
- TypeScript strict; no unused locals or parameters (prefix unused parameters with `_`).
- Pages live in `src/pages/`, layout and routing in `src/app/`. Shared types go in `src/models/`.
- API functions use the v4 `@azure/functions` model with `app.http(...)`, one feature per file in
  `api/src/functions/`.
- Node 22 runtime (see `staticwebapp.config.json`). Dependencies are pinned to exact versions.

## Known gaps
- Legacy site (`acderbySWA`) is the source for porting: `Players.tsx`, `SeasonSchedule.tsx`, `Shop.tsx`
  (Square payments) are not ported yet.
- `api/` tests run from the root (`npm test`), not from inside `api/`.

## Dependency pins
- `react-aria` is pinned to 3.48.0 via `overrides` in `package.json`. Version 3.53.1 ships no `SSRProvider.mjs`,
  which breaks the Vite build through `react-bootstrap` → `@restart/ui` → `@react-aria/ssr`. Remove the
  override only after verifying `npm run build` passes without it.
- `vitest` is pinned to 5.0.3. Vitest 4.1.x failed to install with npm 10.9.8 in this environment.
