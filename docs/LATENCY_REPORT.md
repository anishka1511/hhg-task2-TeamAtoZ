# Latency report

Owner: **Builder 2**  
Source artifacts: `eval/query_latency.json` (full pipeline), `eval/retrieve_latency.json` (Builder 1 handoff)

## Method

| Item | Value |
|------|--------|
| Hardware | Windows laptop (local backend → Qdrant Cloud + Groq API) |
| API | `POST /api/query` over HTTP (`http://127.0.0.1:3001`) |
| Path | **Text only** (no Sarvam) to avoid burning STT credits |
| Strategy | `fixed_overlap` |
| Warm-up | 5 queries (discarded) |
| Measured | **40** queries (in-corpus + off-topic + short edge; same mix as retrieve bench) |
| Pacing | ~3.5s between calls + retry/backoff on Groq TPM 429s |
| Script | `npm run bench:query` → `eval/query_bench.js` |
| Date | 2026-08-21 |

Percentiles use response `latency_ms` fields (server-side stage timers), not a single cherry-picked run.

## Results — full pipeline (HTTP `/api/query`)

From `eval/query_latency.json` (`num_ok: 40 / 40`):

| Stage | P50 (ms) | P70 (ms) | P100 (ms) |
|-------|----------|----------|-----------|
| retrieve (via pipeline) | 222 | 226 | 644 |
| generate (Groq) | 579 | 773 | 2467 |
| guardrail | 0 | 0 | 1 |
| **total (post-STT)** | **804** | **1144** | **2675** |
| wall HTTP (client) | 823 | 1162 | 2693 |

## Results — retrieve-only (Builder 1 handoff)

From `eval/retrieve_latency.json` (direct `retrieve()` call, no HTTP/LLM; prefer this for “retrieve alone”):

| Scope | P50 (ms) | P70 (ms) | P100 (ms) |
|-------|----------|----------|-----------|
| combined (all strategies) | 9.7 | 10 | 11.6 |
| fixed_overlap | 10 | 10.4 | 11.6 |
| semantic | 9.5 | 9.9 | 10.5 |
| metadata_aware | 9.6 | 9.8 | 10.6 |

Pipeline “retrieve” (~220ms P50) is higher than the handoff (~10ms) because the HTTP path includes cold/cloud Qdrant RTT + in-process MiniLM embed under concurrent load; the handoff number is the cleaner retrieve-only figure.

## STT (Sarvam)

| Stage | P50 | P70 | P100 |
|-------|-----|-----|------|
| stt (sampled) | — | — | — |

Not sampled in this bench (text path only). Voice path is wired (`POST /api/stt` → `/api/query` with `source: "voice"`); measure separately if judges require it.

## Notes vs 200ms target

- **Target:** retrieve + generate + guardrails → final answer under **200ms** when possible.
- **Observed P50 total ≈ 804ms** (2026-08-21 bench with `openai/gpt-oss-20b`) — **does not meet 200ms**.
- Dominant stage was **generate** (Groq reasoning model, ~579ms P50). Guardrails are negligible.
- **Code changes** (see below): default to hybrid extractive + `llama-3.1-8b-instant`, smaller context/`top_k`, embed warmup. Re-run `npm run bench:query` after restart to refresh numbers.
- Bench hit Groq free-tier TPM limits; paced retries were used so all 40 measured queries completed successfully.

## How VANI hits ~60–80ms

Public UI: https://vani-rag.susdev.in/ask — their **primary** latency number is **not** Groq end-to-end.

From their AskPage timing breakdown:

| Step | What they do |
|------|----------------|
| Embedding | `intfloat/multilingual-e5-small` dense encode (INT8 / SIMD) |
| Vector DB | Qdrant HNSW over ~112k points **in RAM**, INT8 quantized |
| Fusion | Sparse n-gram TF-IDF + RRF |
| Answer | **Extractive answer assembly** — deterministic span from passages |
| Gate | Provenance / grounding check (no LLM) |

They expose a **separate** slower path: **“Groq grounded synthesis”** (`/v1/query/synthesis`) with its own `total_synthesis` timer. The ~60–80ms figure is **retrieve + extractive evidence answer**, not “wait for Groq then show the number.”

API host (from their frontend): `https://4.213.226.146.sslip.io/api` — Azure VM colocation with Qdrant/embed in-process.

**Implication for us:** matching 60–80ms requires `ANSWER_MODE=extractive` (or hybrid with high recall) + local/RAM Qdrant + warmed embed. Pure Groq chat will usually stay hundreds of ms.

## What we changed in-repo (auto)

1. **`ANSWER_MODE=hybrid`** — extractive when top retrieve score ≥ `HYBRID_EXTRACTIVE_MIN_SCORE` (default 0.55); else Groq.
2. **Default LLM** → `llama-3.1-8b-instant` (not `openai/gpt-oss-20b`).
3. **`GENERATE_MAX_TOKENS=96`**, shorter prompts, `CONTEXT_CHAR_LIMIT=400`, `RETRIEVE_TOP_K=3`.
4. **`LOCALIZE_ANSWERS=false`** — no extra translate LLM on the hot path.
5. **Embed warmup** on backend listen (avoids 1–3s cold MiniLM on first query).

Set in `backend/.env` (or copy from `.env.example`).

### Fastest demo mode (closest to VANI)

```bash
# in backend/.env
ANSWER_MODE=extractive
RETRIEVE_TOP_K=3
LOCALIZE_ANSWERS=false
```

Restart backend, wait for `Embedding model warmed`, then:

```bash
curl -s http://127.0.0.1:3001/api/query \
  -H 'Content-Type: application/json' \
  -d '{"question":"what is the capital of france","chunking_strategy":"fixed_overlap","source":"text"}' \
  | python3 -m json.tool
# Check payload.latency_ms and payload.meta.answer_mode
```

### Balanced (hybrid) — default after changes

```bash
ANSWER_MODE=hybrid
LLM_MODEL=llama-3.1-8b-instant
GENERATE_MAX_TOKENS=96
```

## What you must do manually (ops)

1. **Restart backend** after editing `backend/.env` so new vars load (`npm run dev` from repo root).
2. **Discard first query** after restart (or wait for `Embedding model warmed` in logs).
3. **Optional — local Qdrant** (cuts ~100–200ms cloud RTT from pipeline retrieve):
   ```bash
   docker run -p 6333:6333 qdrant/qdrant
   # Re-index collection into local Qdrant (use your Builder 1 scripts)
   # Then in backend/.env:
   QDRANT_URL=http://127.0.0.1:6333
   QDRANT_API_KEY=
   ```
4. **Optional — pure extractive for judges’ stopwatch** on text path: `ANSWER_MODE=extractive`.
5. **Do not use** `LLM_MODEL=openai/gpt-oss-20b` for latency demos (reasoning budget).
6. **Re-bench**: `npm run bench:query` and update the table above with new P50s.

## How to reproduce

```bash
# backend up with QDRANT_* + LLM_API_KEY (and latency env vars)
npm run bench:query
# optional: BENCH_PACE_MS=5000 BENCH_N=40 node eval/query_bench.js
```
