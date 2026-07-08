# AGENTS.md

## Cursor Cloud specific instructions

### What this is
`MetaboAnalytics` — a frontend-only Vite + React 18 + TypeScript single-page app (Figma Make export). All data is mocked inside the React components; there is **no backend, database, or environment variables**. Client-side routing is via `react-router` (`src/app/App.tsx`).

### Services
Only one service exists: the Vite dev server.
- Run: `pnpm run dev` → serves at `http://localhost:5173/`
- Build: `pnpm run build` (output to `dist/`)
- There is **no lint script and no test suite** defined in `package.json`.

### Non-obvious notes
- Package manager is **pnpm** (per `pnpm-workspace.yaml` and the `pnpm.overrides` block), even though `README.md` says `npm i`. Prefer pnpm; there is no committed lockfile, so versions resolve from the semver ranges in `package.json`.
- `pnpm install` prints a warning that build scripts for `@tailwindcss/oxide` and `esbuild` were ignored. This is safe to ignore — `pnpm run build` and `pnpm run dev` both work without approving them.
- Auth screens (`/login`, `/forgot-password`) are UI-only mocks. The app root `/` renders the Dashboard directly without login; login is not required to reach app functionality.
- `vite.config.ts` defines a custom `figma:asset/` resolver mapping to `src/assets` and aliases `@` → `./src`.
