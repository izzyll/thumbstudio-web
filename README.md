# ThumbStudio web

Paste a YouTube channel: the site studies the style of its most viewed thumbnails (framing, expression, palette, text)
and generates thumbnails for **your** video in that style — never its ideas. https://ts.dgdev.cl

- Everything runs in the visitor's browser: analysis and generation call the visitor's **local models**
  (Ollama, ComfyUI, LM Studio) or their **own API keys** (Gemini, Claude, OpenAI, fal.ai, Replicate). Keys stay in localStorage.
- The server only does three things, as Cloudflare Pages Functions in `functions/api/`:
  - `channel/top`: YouTube Data API with the site's key, cached 6 h in KV. When the daily quota runs out it answers
    `429 {code:"quota"}` and the UI shows "No podemos procesar tu solicitud hoy".
  - `thumb/[id]`: same-origin copy of a thumbnail so the canvas can read it.
  - `relay`: forwards Replicate calls (no CORS there); only `api.replicate.com` and `replicate.delivery`, nothing is stored.
- The UI follows the Pencil design in `design/` (screens exported to `design/screens/`).

## Development

```
npm install
cp .env.example .dev.vars        # put YOUTUBE_API_KEY in .dev.vars
npm run dev:api                  # Pages Functions on :8788 (wrangler)
npm run dev                      # Next.js on :3000; /api/* is proxied to :8788
```

`npm run preview` builds the static site and serves it together with the functions, as in production.
`npm run typecheck` and `npm run lint` check both the app and `functions/`.

Local models in the browser need CORS for the page's origin (the studio's Settings shows the exact commands):

- Ollama: `OLLAMA_ORIGINS=https://ts.dgdev.cl` (127.0.0.1 origins are allowed by default). Needs a vision model, e.g. `ollama pull qwen2.5vl:7b`.
- ComfyUI: `--enable-cors-header https://ts.dgdev.cl`, or ComfyUI Desktop → Settings → Server-Config → Enable CORS header.
- LM Studio: Developer → Server Settings → Enable CORS.

Safari blocks `http://localhost` from an https page; use Chrome or Edge for local models.

## Deploy to Cloudflare Pages

1. `npx wrangler login`
2. `npx wrangler kv namespace create CACHE` and paste the id into `wrangler.toml`.
3. `npx wrangler pages project create thumbstudio`
4. `npx wrangler pages secret put YOUTUBE_API_KEY --project-name thumbstudio`
5. `npm run deploy`
6. In the Pages project → Custom domains, add `ts.dgdev.cl` (automatic if `dgdev.cl` is on Cloudflare DNS).
