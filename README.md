# HHG Task 2 — Voice-Enabled RAG (Team AtoZ)

Voice → **Sarvam** STT → multi-strategy chunking + vector retrieval → grounded answer (+ guardrails).

- **Repo:** https://github.com/anishka1511/hhg-task2-TeamAtoZ  
- **Deadline:** 22 Aug 2026, 11:59 PM  
- **Dataset:** [ai4bharat/MSMARCO-XI](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI)  
- **Team plan:** [docs/TEAM_TASKS.md](docs/TEAM_TASKS.md)

> This commit is a **scaffold only**. STT, chunking, retrieval, generation, and deploy are owned by Builders per `docs/TEAM_TASKS.md`.

## Pipeline

```text
Mic / text → Sarvam STT (or text fallback) → retrieve (Qdrant) → LLM generate → guardrails → UI
```

## Repo layout

```text
backend/     Fastify API (health, stt, query harness stubs)
frontend/    Next.js baseline UI + mocks for Member 3
indexing/    MSMARCO-XI ingest + chunking stubs (Builder 1)
eval/        Latency bench stub (Builder 2)
docs/        Team tasks, chunking, latency, promo
docker-compose.yml   Local Qdrant
```

## Quick start (scaffold)

```bash
cp .env.example .env
npm run install:all
docker compose up -d qdrant   # optional until indexing exists
npm run dev
```

- Frontend: http://localhost:3000  
- Backend: http://localhost:3001/api/health  

Member 3 mock mode:

```bash
# in frontend/.env.local
NEXT_PUBLIC_USE_MOCKS=true
```

## API contract (frozen)

See [docs/TEAM_TASKS.md](docs/TEAM_TASKS.md). Summary:

| Method | Path | Owner |
|--------|------|--------|
| GET | `/api/health` | Builder 2 |
| POST | `/api/stt` | Builder 2 (Sarvam) |
| POST | `/api/query` | Builder 2 harness + Builder 1 retrieve |

## Roles

| Role | Owns |
|------|------|
| Builder 1 | Chunking, Qdrant, retrieve |
| Builder 2 | Sarvam, gen, guardrails, latency, deploy, baseline UI |
| Member 3 | UI polish + videos/social ([plain English](docs/MEMBER3_PLAIN.md)) |

## Deploy (decide host later)

Shape (do not over-split):

- Frontend → e.g. Vercel  
- Backend → **one** always-on host (Railway paid / Fly / VPS) — not sleeping free Render  
- Qdrant → Docker beside backend **or** Qdrant Cloud  

## Branches

- `feat/b1-retrieval`
- `feat/b2-pipeline-deploy`
- `feat/m3-ui-promo`

## License

Educational / shortlisting submission for HH Goa 2026.
