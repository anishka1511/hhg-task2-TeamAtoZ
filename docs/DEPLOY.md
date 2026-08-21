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

1. Import the GitHub repo; root directory `frontend` (or monorepo setting).
2. Env: `NEXT_PUBLIC_API_URL=https://YOUR_BACKEND_URL` (use `https` so the UI opens `wss://` for streaming).
3. Optional: `NEXT_PUBLIC_DEMO_PASSWORD=...`, `NEXT_PUBLIC_VOICE_SILENCE_MS=1500`

## Smoke test

1. `GET https://BACKEND/api/health` → `qdrant.ok`, `stt`, `llm` ok  
2. Incognito UI → text query → answer  
3. Nonsense query → guardrail refuse  
4. Mic → live words in the box → pause ~1.5s → auto query  
