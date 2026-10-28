# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

ThumbStudio: the visitor pastes a YouTube channel, the site studies the style of its most viewed thumbnails and generates thumbnails for the visitor's own video in that style (never its ideas). Production: https://ts.dgdev.cl. UI copy and user-facing error messages are in Spanish; code and comments are in English.

## Commands

```
npm run dev:api     # Pages Functions on :8788 (wrangler; reads .dev.vars, copy from .env.example)
npm run dev         # Next.js on :3000; /api/* is rewritten to :8788 in development only
npm run typecheck   # next typegen + tsc for the app + tsc -p functions
npm run lint        # eslint (app and functions)
npm run preview     # static build + wrangler pages dev out (production-like)
npm run deploy      # static build + wrangler pages deploy
```

There is no test suite. Verify changes with `typecheck`, `lint`, and running the app. Set `SIMULATE_QUOTA=1` in `.dev.vars` to exercise the "daily YouTube limit reached" path.

## Architecture

**Static export + Pages Functions.** `next.config.ts` uses `output: "export"` — there is no Next.js server, no route handlers, no server actions, no image optimization. Anything server-side goes in `functions/api/` as Cloudflare Pages Functions (`onRequestGet: PagesFunction<Env>`), bundled by wrangler, not Next. Bindings are typed in `functions/env.ts` (`YOUTUBE_API_KEY`, `SIMULATE_QUOTA`, KV `CACHE`). The server does only three things:
- `channel/top` — YouTube Data API with the site's key, cached 6 h in KV; quota exhaustion becomes `429 {code:"quota"}`, which the UI shows as a banner.
- `thumb/[id]` — same-origin copy of a thumbnail so canvases can read its pixels (`thumbUrl()` in `lib/image.ts`).
- `relay` — forwards Replicate calls (no CORS there); allowlisted to `api.replicate.com` and `replicate.delivery`, stores nothing.

**Code shared with functions.** `functions/tsconfig.json` includes `lib/youtube.ts` and `lib/types.ts`, so those two files must stay free of Next.js/React/DOM imports and the `@/` alias (use relative imports). Every other `lib/` file is `"use client"` browser code.

**Everything else runs in the visitor's browser** with the visitor's local models (Ollama, LM Studio/OpenAI-compatible, ComfyUI) or their own API keys (Gemini, Anthropic, OpenAI, fal.ai, Replicate). Keys live in localStorage (`lib/settings.ts`, key `thumbstudio.settings`) and are sent only to their own provider (SDKs are created with `dangerouslyAllowBrowser: true` and loaded via dynamic `import()`). Never route visitor keys through our functions except Replicate via `/api/relay`.

**Two pluggable registries:**
- `lib/analysis.ts` — `LLMS: Record<LlmId, …>`: vision LLMs that receive a contact sheet of the reference thumbnails + an objective `StyleProfile` + the visitor's video context, and return JSON matching `SCHEMA` (style patterns + concepts). `analyze()` strips code fences, parses, and normalizes each concept with `clean()`. Ollama uses a reduced `localSchema()` and `keep_alive: 0` so ComfyUI gets the VRAM back.
- `lib/providers.ts` — `PROVIDERS: Provider[]`: image generators (`comfyui`, `gemini`, `openai`, `fal`, `replicate`), each with `models`, `ready`, `needs`, and `generate(settings, args) → Blob[]`. Style references are passed with rules that say "copy style, not subject". ComfyUI builds its workflow JSON in code (SDXL or Flux/GGUF) and picks checkpoints from `/object_info`.

Adding a model/provider means adding an entry to one of these registries; the UI lists them from there.

**Local services.** Unreachable local services throw `LocalUnreachable(service)`; the UI catches it and shows CORS setup help from `corsHelp()` in `lib/local.ts` (based on `siteOrigin()` / `NEXT_PUBLIC_SITE_ORIGIN`). `lib/hardware.ts` detects the visitor's GPU/VRAM (exact via ComfyUI `/system_stats` when connected) and recommends local vs. cloud.

**Image pipeline (`lib/image.ts`, canvas-based).** 1280×720 output, `to16x9`, `contactSheet` (sent to the LLM), `styleProfile` (palette/brightness/saturation computed from pixels), `addText` (title overlay drawn locally with the Anton font — generated images are prompted to contain no text), and `compareSheet`.

**Studio UI.** `app/studio/page.tsx` wraps `<Studio>` in `Suspense` (it reads `?c=` via `useSearchParams`, required in a static export). `components/studio/Studio.tsx` owns all state and exposes it through `StudioContext` (`state.tsx`, `useStudio()`); four steps — Channel → Video → Analysis → Generate — plus `TopBar` and `SettingsDrawer`. Changing the channel resets analysis/concepts/results. Settings load from localStorage only after mount, so initial render uses `DEFAULTS`.

## Conventions

- Next.js 16 / React 19 / Tailwind v4. Tailwind is wired through a Turbopack CSS loader rule in `next.config.ts` (`@tailwindcss/turbopack`), not PostCSS. Design tokens (colors, `font-display` = Anton, `font-sans` = Inter) are in `@theme` in `app/globals.css`; use those token classes rather than raw colors.
- The UI follows the Pencil design; exported screens are in `design/screens/`. `.pen` files must be accessed via the Pencil MCP tools only.
- The lint rule `react-hooks/set-state-in-effect` is intentionally disabled inline where state is set from localStorage or async checks after mount; keep the explanatory comment when doing the same.
- Deploy setup (KV namespace id in `wrangler.toml`, `YOUTUBE_API_KEY` secret, custom domain) is documented in `README.md`.
