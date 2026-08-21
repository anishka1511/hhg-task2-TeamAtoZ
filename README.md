# HHG Task 2 — Voice-Enabled RAG (Team AtoZ)

Voice → **Sarvam** STT → multi-strategy retrieval (Qdrant) → grounded **Groq** answer → guardrails → UI.

- **Repo:** https://github.com/anishka1511/hhg-task2-TeamAtoZ  
- **Deadline:** 22 Aug 2026, 11:59 PM  
- **Dataset:** [ai4bharat/MSMARCO-XI](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI)  
- **Team plan:** [docs/TEAM_TASKS.md](docs/TEAM_TASKS.md)  
- **Latency:** [docs/LATENCY_REPORT.md](docs/LATENCY_REPORT.md) · **Chunking:** [docs/CHUNKING.md](docs/CHUNKING.md)

## Pipeline

```text
Mic / text → Sarvam STT (or text fallback) → retrieve (Qdrant) → Groq generate → guardrails → UI
```

## Quick start (local)

```bash
cp .env.example .env
cp .env.example backend/.env   # backend loads dotenv from its CWD
# Fill: SARVAM_API_KEY, LLM_API_KEY, QDRANT_URL (+ :6333), QDRANT_API_KEY, QDRANT_COLLECTION

npm run install:all
npm run dev
```

- Frontend: http://localhost:3000  
- Backend health: http://localhost:3001/api/health  

Text **Ask** works without burning Sarvam credits. **Mic** → `/api/stt` → `/api/query` (`source: voice`).

## API contract (frozen)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/health` | `qdrant`, `stt`, `llm` status |
| POST | `/api/stt` | multipart field `file` → Sarvam |
| POST | `/api/query` | `{ question, source, chunking_strategy }` |
| POST | `/api/retrieve` | Builder 1 retrieve-only |

Strategies: `fixed_overlap` \| `semantic` \| `metadata_aware` (alias: `metadata`).

## Latency bench

Backend must be running with Qdrant + `LLM_API_KEY`:

```bash
npm run bench:query
# writes eval/query_latency.json — fill docs/LATENCY_REPORT.md from that + eval/retrieve_latency.json
```

## Deploy shape

| Piece | Recommendation |
|-------|----------------|
| Frontend | Vercel (Next.js) — set `NEXT_PUBLIC_API_URL` to public backend |
| Backend | **Always-on** container (Railway / Fly / small VPS). Not sleeping free Render. |
| Qdrant | Qdrant Cloud (already used) or Docker beside backend |
| Image | `Dockerfile` at repo root (`node backend/src/server.js`) |

### Backend env (production)

Same as `.env.example`, plus:

- `CORS_ORIGIN` = your Vercel URL (or `*` only for short demos)
- `DEMO_PASSWORD` = optional shared secret; clients send `x-demo-password`
- `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` = soft limits on `/api/query` and `/api/stt`

### Demo checklist

1. Incognito → frontend → text question (in-corpus) → answer + contexts  
2. Nonsense question → guardrail refusal  
3. `/api/health` green on the public backend  
4. Prefer text over mic during grading to save Sarvam credits  

## Roles

| Role | Owns |
|------|------|
| Builder 1 | Chunking, Qdrant, retrieve |
| Builder 2 | Sarvam, generate, guardrails, latency, deploy, baseline UI |
| Member 3 | UI polish + videos ([docs/MEMBER3_PLAIN.md](docs/MEMBER3_PLAIN.md)) |

## Branches

- `feat/b1-retrieval`
- `feat/b2-pipeline-deploy`
- `feat/m3-ui-promo`

## License

Educational / shortlisting submission for HH Goa 2026.
