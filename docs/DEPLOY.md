# Deploy notes (Builder 2)

## Goal

Always-on public demo: frontend (Vercel) + backend container + Qdrant Cloud.

## Backend (Docker)

From repo root:

```bash
docker build -t hhg-backend .
docker run --rm -p 3001:3001 --env-file backend/.env -e CORS_ORIGIN=https://YOUR_FRONTEND.vercel.app hhg-backend
```

Or deploy the same `Dockerfile` on **Railway / Fly / any VPS** (not sleeping free Render).

### WebSockets (required for live Mic)

Live mic uses `WS /api/stt/stream` (Sarvam streaming proxy). The host must support **long-lived WebSockets** (Railway, Fly, most VPS). Pure serverless HTTP (some free tiers / edge functions) will break live transcript — text Ask and `POST /api/stt` still work.

### Required env

- `LLM_API_KEY`, `LLM_PROVIDER=groq`, `LLM_MODEL=...`
- `SARVAM_API_KEY` (mic path)
- Optional streaming: `SARVAM_STREAM_MODEL`, `SARVAM_LANGUAGE`, `SARVAM_WEBSOCKET_URL`
- `QDRANT_URL` (include `:6333`), `QDRANT_API_KEY`, `QDRANT_COLLECTION`
- `CORS_ORIGIN` = frontend origin
- Optional: `DEMO_PASSWORD`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`

### Hardening

- `/api/query`, `/api/stt`, and `/api/stt/stream` are soft rate-limited per IP.
- If `DEMO_PASSWORD` is set, clients must send header `x-demo-password` (or `?demo_password=` for WS).
- Frontend: set `NEXT_PUBLIC_DEMO_PASSWORD` to the same value (build-time).

## Frontend (Vercel)

Framework: **Next.js 14** (`frontend/package.json` → `"next": "^14.0.4"`).

1. Import the GitHub repo on Vercel.
2. **Settings → General → Root Directory:** `frontend` → Save.
3. **Settings → Build & Deployment → Framework Preset:** **Next.js** (not Other).
4. Leave **Build Command** / **Output Directory** at defaults (Override **off**):
   - Build: `npm run build` or `next build`
   - Output: `.next`
5. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL=https://YOUR_BACKEND_URL` (Railway URL, `https`, no trailing slash)
   - Optional: `NEXT_PUBLIC_DEMO_PASSWORD=...`, `NEXT_PUBLIC_VOICE_SILENCE_MS=1500`
6. Deploy (push to `main` or Redeploy after changing preset).

`frontend/vercel.json` only sets region (`bom1`); do not override build/output there unless you have a specific reason.

### Troubleshooting: "No entrypoint found … src/main.js …"

This means Vercel is building the **repo root**, not `frontend/`. Root `package.json` has no `next` dependency, so Vercel looks for `src/server.js` etc. and fails.

**Fix (Vercel dashboard):**
1. **Settings → General → Root Directory** → set to **`frontend`** → Save
2. **Settings → Build & Deployment → Framework Preset** → **Next.js** (not Other)
3. Turn **Override off** for Build Command and Output Directory
4. Redeploy (push to `main` or Redeploy latest)

**Do not deploy the backend on Vercel** — backend goes on Railway (Docker). Vercel is frontend only.

## Smoke test

1. `GET https://BACKEND/api/health` → `qdrant.ok`, `stt`, `llm` ok  
2. Incognito UI → text query → answer  
3. Nonsense query → guardrail refuse  
4. Mic → live words in the box → pause ~1.5s → auto query  
