# Chunking strategies (Builder 1)

Owner: **Builder 1**

Input: `indexing/data/processed/passages.jsonl` (from `ingest.py`).  
Dispatcher: `indexing.chunking.chunk_document(record, strategy)`.

Params live in [`indexing/config.yaml`](../indexing/config.yaml) under `chunking.*`. Numbers below were measured by running all three strategies on the **full** processed corpus (**5000** passages) via `python indexing/scripts/test_chunking.py`.

Validation on the **first 10** documents produced distinct totals: `fixed_overlap=10`, `semantic=11`, `metadata_aware=10`.

---

## `fixed_overlap`

### Parameters (from config.yaml)
- `size_chars`: **512**
- `overlap_chars`: **64** (step = 512 − 64 = **448**)
- Tiny trailing remainder rule: if the last window is under **~20%** of `size_chars` (~102 chars), it is **merged** into the previous chunk instead of standing alone.

### Chunk size / overlap behavior
Sliding character windows of up to 512 chars with 64-char overlap. Passages shorter than 512 emit a single chunk. Overlap keeps boundary context across adjacent windows.

### Observed lengths (full corpus)
| Metric | Value |
|--------|--------|
| Total chunks (≈ Qdrant points for this strategy) | **5465** |
| Min chunk length | **65** |
| Max chunk length | **550** (can exceed 512 when a short remainder is merged) |
| Avg chunk length | **~314** |

### Pros
- Simple, deterministic, easy to reason about.
- Overlap reduces the chance that a key phrase is cut off at a window edge with no representation in any chunk.

### Cons
- Can split mid-sentence / mid-thought.
- Overlap duplicates text across chunks (more vectors, some redundancy).

### Recall considerations
Good default recall for keyword-ish spans that might sit on a boundary thanks to overlap. Risk: a concept split across a cut without enough overlap still hurts retrieval.

### Noise considerations
Partial sentences at window edges can dilute embeddings with incomplete thoughts.

### Latency / index size
**5465** points vs 5000 passages (~9% more vectors). At this corpus size the search-latency impact is small; more points mainly mean a slightly larger Qdrant collection, not a dramatic slowdown.

### When to pick at query time
Use as the **safe default** (`chunking_strategy: "fixed_overlap"`) when you want predictable chunk sizes and do not know whether passages are short or long.

---

## `semantic`

### Parameters (from config.yaml)
- `max_chars`: **512**
- Sentence split: `nltk.tokenize.sent_tokenize` (with `punkt` / `punkt_tab`), regex fallback if tokenizer data is unavailable.

### Chunk size / overlap behavior
Sentences are packed greedily until adding the next sentence would exceed 512 chars, then a new chunk starts. A single sentence longer than 512 becomes its own chunk (may exceed `max_chars`; logged at debug). **No overlap** between chunks.

### Observed lengths (full corpus)
| Metric | Value |
|--------|--------|
| Total chunks | **5675** |
| Min chunk length | **6** |
| Max chunk length | **625** |
| Avg chunk length | **~297** |

### Pros
- Keeps sentences whole → better local coherence for LLM context and embeddings.
- Adapts chunk count to how “sentence-dense” a passage is.

### Cons
- Chunk sizes vary; short leftover sentences create small chunks (min length 6 observed).
- Occasional oversize single-sentence chunks.

### Recall considerations
Best when **passage coherence** matters (answer lives in a full sentence). Weaker if the relevant span is mid-sentence and packing groups it with unrelated sentences up to 512 chars.

### Noise considerations
Less boundary noise than fixed windows. Very short chunks can be noisy / under-informative embeddings.

### Latency / index size
**5675** points — highest of the three (~13% above passage count). Still modest for ~5k-base corpus; expect only slight search overhead vs `fixed_overlap`.

### When to pick at query time
Prefer when **sentence integrity** matters most — e.g. definitional / descriptive answers where cutting mid-sentence would confuse generation.

---

## `metadata_aware`

### Parameters (from config.yaml)
- `split_threshold_chars`: **800**
- If `len(text) <= 800`: emit **one** chunk for the whole passage (`para_index: 0`).
- If longer: split on `\n\n`, else `\n`, else sentence boundaries (same splitter as semantic). Each segment gets `para_index` (0-based).

### Chunk size / overlap behavior
Preserves full passage context whenever passages are short (most of MSMARCO-style passages). Only long outliers are split. Metadata always includes `query_id`, `is_selected`, `query_type`, `doc_id`, `target_lang`, plus `para_index`.

### Observed lengths (full corpus)
| Metric | Value |
|--------|--------|
| Total chunks | **5191** |
| Min chunk length | **7** |
| Max chunk length | **796** |
| Avg chunk length | **~325** |

(Only **27** passages in this ingest are longer than 800 chars, so most records stay one chunk; the extra **191** chunks come from splitting those long tails.)

### Pros
- Maximal context for typical short passages — closest to “retrieve the whole passage.”
- Rich metadata for query-time filters (e.g. prefer `is_selected == 1`).

### Cons
- Long passages without newlines fall back to sentence splits (can look like semantic).
- Chunks can be larger than MiniLM’s “comfortable” window in spirit (up to ~800 chars) though still fine for 384-d MiniLM input limits in practice.

### Recall considerations
Strong when the answer needs **full passage context** and most docs are already short. Weaker if a long passage packs many topics into one vector (dilution) — then fixed/semantic splits help.

### Noise considerations
Low for short single-chunk passages. Sentence-fallback segments can still be very short (min 7).

### Latency / index size
**5191** points — closest to 1:1 with passages; **smallest index** of the three. Slightly faster / lighter than the others at this scale.

### When to pick at query time
Choose when **most passages are already short** and splitting would throw away useful surrounding context — e.g. demo queries against MS MARCO-style snippets, or when you want to filter by `is_selected` / `query_type` metadata.

---

## Summary (full 5000-passage corpus)

| Strategy | Chunks | Min len | Max len | Avg len |
|----------|--------|---------|---------|---------|
| `fixed_overlap` | 5465 | 65 | 550 | ~314 |
| `semantic` | 5675 | 6 | 625 | ~297 |
| `metadata_aware` | 5191 | 7 | 796 | ~325 |

Re-run measurements after changing `config.yaml` or re-ingesting:

```bash
source indexing/.venv/bin/activate
python indexing/scripts/test_chunking.py
```
