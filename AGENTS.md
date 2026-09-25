<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Wizualizator nieruchomości: guide for AI agents (Codex, Claude Code)

Full project rules: `CLAUDE.md`. Setup for humans: `docs/URUCHOMIENIE.md`. Product: `docs/PRD.md`, plan: `docs/ROADMAP.md`.

## What this is

B2B web app for real estate offices: from photos and room areas to an interactive 3D apartment, room images, videos and a public offer page. Demo: https://wizualizator-nieruchomosci.vercel.app

## Hard rules

- **No paid AI services** (no Higgsfield, no per-generation APIs). Use open-source models and libraries only: three.js, Depth Anything V2 via transformers.js (browser), Wan 2.2 TI2V-5B in local ComfyUI (`video-worker/`), RIFE.
- UI text in **Polish**; code, identifiers and commits in **English**.
- Every render, model and video shows the label „Wizualizacja poglądowa”.
- The demo has **no database**: offers live in the browser (`lib/demo/`, localStorage + IndexedDB). The planned backend is Supabase with `org_id` + RLS on every table (ROADMAP M1–M2).
- Next.js **16**: middleware is `proxy.ts`; read `node_modules/next/dist/docs/` before using unfamiliar APIs (see block above).
- Keep commits small; run the checks below before committing.

## Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm run test         # Vitest (lib/plan etc.)
npm run typecheck    # next typegen + tsc
npm run lint
npm run e2e          # Playwright; needs: npx playwright install chromium
```

`npm run wideo` (Film AI worker) needs Windows + NVIDIA GPU + ComfyUI and models; it cannot run in a cloud sandbox. Do not try to start it there.

## Map

| Path | What |
|---|---|
| `app/(panel)/` | office panel: offers, offer wizard, offer page, /wyprobuj (photo → 3D/film), settings, integrations |
| `app/o/[slug]`, `app/embed/[slug]` | public offer page and iframe embed |
| `lib/plan/` | plan types, `autoLayout.ts` (floor plan from room areas), sample flat |
| `components/model3d/` | three.js apartment scene and viewer; `walkController.ts` first-person walk (collisions and routes in `lib/plan/walk.ts`) |
| `lib/video/` | in-browser video recording: 3D tour, reel, photo-3D film, AI montage, room views |
| `lib/depth/`, `components/photo3d/` | depth from a photo (Depth Anything V2) and 3D photo viewer |
| `lib/aiVideo/`, `components/AiVideoPanel.tsx` | client for the Film AI worker |
| `video-worker/` | Film AI worker (Node) + ComfyUI workflow + custom node `comfy_nodes` |
| `lib/demo/` | browser data store for the demo |
| `tests/unit`, `e2e/` | Vitest and Playwright tests |

