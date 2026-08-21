# Team tasks — HHG Task 2 (Voice RAG)

**Repo:** https://github.com/anishka1511/hhg-task2-TeamAtoZ  
**Deadline:** 22 Aug 2026, 11:59 PM  
**Pipeline:** Voice → **Sarvam** STT → chunking/retrieval (vector DB) → answer (+ guardrails)  
**Dataset:** https://huggingface.co/datasets/ai4bharat/MSMARCO-XI

## Roles

| Role | Focus |
|------|--------|
| **Builder 1** | Knowledge layer: dataset, ≥3 chunking strategies, embeddings, Qdrant, retrieve |
| **Builder 2** | App pipeline: Sarvam STT, harness, generation, guardrails, latency, deploy, baseline UI |
| **Member 3** | UI polish, demo script, videos + `#RAGInGoa` promo (non-blocking) |

Old spikes under the parent `hhg-task2` folder are **reference only** — do not submit them.

---

## Shared rules

1. **STT = Sarvam only** on the submitted path (no Chrome / Deepgram / ElevenLabs).
2. **Text fallback mandatory:** `POST /api/query` with a typed question (save Sarvam credits).
3. **No secrets in git** — only `.env.example`.
4. **Frozen API contract** (change only by Builder 1+2 agreement):

```http
GET  /api/health
→ { "status": "ok", "services": { "qdrant": "...", "stt": "...", "llm": "..." } }

POST /api/stt
Content-Type: multipart/form-data
file=<audio>
→ { "transcript": "...", "duration_ms": 1234, "provider": "sarvam" }

POST /api/query
{ "question": "...", "source": "text" | "voice", "chunking_strategy": "fixed_overlap" | "semantic" | "metadata_aware" | "token_window" | "structure_aware" | "recursive" }
→ {
  "answer": "...",
  "contexts": [{ "id": "...", "text": "...", "score": 0.0, "strategy": "..." }],
  "guardrail": { "allowed": true, "reason": null },
  "latency_ms": { "stt": 0, "retrieve": 12, "generate": 80, "guardrail": 5, "total": 97 }
}
```

5. **Latency:** instrument every stage; publish **P50 / P70 / P100**. Treat **retrieve + generate + guardrails → final answer** as the 200ms target; report STT separately and honestly.
6. **Submission:** GitHub + live link + 2 videos; each person posts both on IG, X, LinkedIn with `#RAGInGoa`; ≥1 IG public; **no resubmits**.
7. **Member 3 never blocks ship.** Builder 2’s baseline UI is enough to demo/submit if polish is late.

---

## Builder 1 — Chunking, indexing, vector DB, retrieval

### Mission
MSMARCO-XI in Qdrant, **≥3 serious chunking strategies**, fast `retrieve()` for Builder 2.

### Scope in
Dataset subset, preprocess + metadata, chunking pack, embeddings + Qdrant, retrieve API, retrieve-latency stats, `docs/CHUNKING.md`

### Scope out
Sarvam, LLM prompts, production CSS, social posts, hosting accounts (except connection strings)

### Tasks
| ID | Task | Location |
|----|------|----------|
| B1.1 | Dataset plan + subset docs | `indexing/README.md`, `indexing/config.yaml` |
| B1.2 | Ingest + normalize | `indexing/scripts/ingest.py` |
| B1.3 | Chunking pack (≥3) | `indexing/chunking/*`, `docs/CHUNKING.md` |
| B1.4 | Embeddings + Qdrant upsert | `indexing/scripts/build_index.py`, `backend/.../qdrantClient.js` |
| B1.5 | `retrieve(query, { strategy, top_k })` | `backend/src/services/retrieve/index.js` |
| B1.6 | Retrieve latency bench (feed Builder 2) | script + numbers for latency report |

### Done when
- [ ] ≥3 strategies live + documented  
- [ ] Subset indexed in Qdrant  
- [ ] Stable retrieve interface  
- [ ] Retrieve P50/P70/P100 available  
- [ ] No secrets in git  

---

## Builder 2 — STT, harness, generation, guardrails, latency, deploy

### Mission
End-to-end product path + live URL. Keep a **functional baseline UI** so demos never wait on Member 3.

### Scope in
Sarvam STT + text path, pipeline harness, grounded generation, guardrails, latency report, deploy + harden, baseline UI

### Scope out
Designing the three chunking algorithms; fancy CSS; reopening frozen vendor decisions

### Tasks
| ID | Task | Location |
|----|------|----------|
| B2.1 | Server + health probes | `backend/src/server.js`, `routes/health.js` |
| B2.2 | Sarvam STT adapter | `services/stt/sarvam.js`, `routes/stt.js` |
| B2.3 | Query harness | `services/pipeline.js` |
| B2.4 | Grounded generation | `services/generate/` |
| B2.5 | Guardrails | `services/guardrails/` |
| B2.6 | Latency analytics P50/P70/P100 | `eval/latency_bench.js`, `docs/LATENCY_REPORT.md` |
| B2.7 | Functional baseline UI | `frontend/app/page.jsx` |
| B2.8 | Deploy + rate limit / demo gate | host TBD (always-on; not sleeping free Render) |
| B2.9 | Submission README + freeze | root `README.md` |

### Done when
- [ ] Sarvam + text query both work  
- [ ] Harness + guardrails + grounded answers  
- [ ] Latency report committed  
- [ ] Live link stable  
- [ ] Baseline UI demoable without Member 3  

---

## Member 3 — Frontend polish + demo / promo

### Mission
Look submission-ready + mandatory videos/social. **No architecture decisions.** Use mocks day 1.

### Scope in
Visual UI on frozen APIs, responsive states, demo script, video help, promo checklist, short “How to try” copy

### Scope out
Sarvam keys, Qdrant/chunking, LLM/guardrails, latency methodology, deploy, switching STT vendors

### Tasks
| ID | Task |
|----|------|
| M3.1 | Build against `frontend/mocks/*.json` |
| M3.2 | Visual single-page demo (text + mic UI; call only documented endpoints) |
| M3.3 | Wire to staging/prod `NEXT_PUBLIC_API_URL` |
| M3.4 | 60–90s demo script (success + refusal + optional voice) |
| M3.5 | Videos + 18-post `#RAGInGoa` checklist |
| M3.6 | Timebox: UI v1 by agreed day; then bugfixes only |

Plain-English handoff: [`docs/MEMBER3_PLAIN.md`](./MEMBER3_PLAIN.md)

### Done when
- [ ] Polished UI on mocks or real API  
- [ ] Demo script ready  
- [ ] Promo checklist complete  
- [ ] Did not block Builder merges  

---

## Branches

- `feat/b1-retrieval`
- `feat/b2-pipeline-deploy`
- `feat/m3-ui-promo`

Merge to `main` via PR.

## Day plan (summary)

| Day | Builders | Member 3 |
|-----|----------|----------|
| 1 | Freeze API; subset + health; mocks | UI on mocks |
| 2–3 | Index + retrieve; STT + gen + guardrails | Visual polish |
| 4 | E2E + latency script | Wire real API |
| 5 | Deploy + latency report | Demo script / record help |
| 6 | Freeze | Posts + checklist; submit once |

## Deploy note

Decide host later, but shape is fixed: **frontend (e.g. Vercel) + one always-on backend host + Qdrant (Docker beside backend or Qdrant Cloud)**. Do not put API on sleeping free tiers.
