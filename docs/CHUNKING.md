# Chunking strategies (Builder 1)

Owner: **Builder 1**

Input: `indexing/data/processed/passages.jsonl` (from `ingest.py`).  
Dispatcher: `indexing.chunking.chunk_document(record, strategy)`.

Params live in [`indexing/config.yaml`](../indexing/config.yaml) under `chunking.*`. Numbers below were measured by running all strategies on the **full** processed corpus (**5000** passages) via `python indexing/scripts/test_chunking.py`.

Validation on the **first 10** documents produced distinct totals across strategies (e.g. `fixed_overlap=10`, `semantic=11`, `token_window=11`).

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

## `token_window`

### Parameters (from config.yaml)
- `size_tokens`: **80** (whitespace-separated words)
- `overlap_tokens`: **16** (step = 80 − 16 = **64** words)
- Tiny trailing remainder rule: if the last window is under **~20%** of `size_tokens`, it is **merged** into the previous chunk.

### Chunk size / overlap behavior
Sliding **word** windows instead of raw characters. Better aligns with natural phrase boundaries than char windows of the same nominal size, while staying as deterministic as `fixed_overlap`.

### Observed lengths (full corpus)
| Metric | Value |
|--------|--------|
| Total chunks (≈ Qdrant points for this strategy) | **5823** |
| Min chunk length | **65** |
| Max chunk length | **611** |
| Avg chunk length | **~303** |

### Pros
- Word-aligned cuts — less mid-word / mid-number tearing than char windows.
- Overlap still protects boundary phrases.
- Easy to explain and tune (`size_tokens` / `overlap_tokens`).

### Cons
- Word length varies; 80 tokens is not a fixed char budget.
- Still can split mid-sentence.
- Highest chunk count of the six → slightly larger index.

### Recall considerations
Good default when queries are short keyword-ish phrases and you want chunks that cover a predictable number of words. Overlap helps when the answer straddles a window edge.

### Noise considerations
Cleaner than char windows on average; noise still appears when a window starts mid-thought.

### Latency considerations
**5823** points — most vectors of any strategy here. At this corpus size the Qdrant cost difference vs ~5k points is small.

### Index-size implications
More points than `fixed_overlap` (~6% more) because word windows of 80 often map to fewer chars than 512 when tokens are short, producing more slices on long passages.

### When to pick at query time
Use when you care about **word-level coverage** (e.g. entity-heavy questions) more than sentence coherence.

---

## `structure_aware`

### Parameters (from config.yaml)
- `max_chars`: **512**
- Detects structural lines: markdown headings (`#`), short ALL-CAPS titles, numbered lists (`1. …`), bullets (`-` / `*` / `•`).
- If **no** structural markers: falls back to paragraph / newline / sentence splits (same idea as `metadata_aware`).
- Short single-section passages under `max_chars` stay one chunk. Otherwise sections are greedily packed under `max_chars`.
- Each chunk gets `section_index` (0-based) in metadata.

### Chunk size / overlap behavior
Structure-first segmentation, then packing. No sliding overlap — sections are whole units unless packing merges adjacent short ones.

### Observed lengths (full corpus)
| Metric | Value |
|--------|--------|
| Total chunks (≈ Qdrant points for this strategy) | **5692** |
| Min chunk length | **4** |
| Max chunk length | **658** (a single oversize structural section can exceed `max_chars`) |
| Avg chunk length | **~298** |

### Pros
- Respects list items and heading-like breaks when present.
- `section_index` helps debugging / citing which block was retrieved.
- Falls back cleanly on flat MS MARCO prose.

### Cons
- Heuristic markers can fire on false positives (short shouty lines).
- No overlap — facts at section edges may sit in only one chunk.
- On flat prose, behavior converges toward paragraph/sentence splits.

### Recall considerations
Best when passages have **lists or titled blocks** (FAQ-style / web dumps). Weaker on continuous narrative with no markers.

### Noise considerations
False structural splits can isolate tiny fragments (see min length **4**). Packing reduces that when neighbors fit under `max_chars`.

### Latency considerations
**5692** points — mid pack; similar to `semantic`.

### Index-size implications
Comparable to sentence packing; not a large jump over the original three.

### When to pick at query time
Pick for questions that map to **a bullet, numbered step, or headed subsection** rather than a free-form paragraph.

---

## `recursive`

### Parameters (from config.yaml)
- `max_chars`: **512**
- Split hierarchy: **double newline → single newline → sentences → hard character windows**, then pack adjacent undersized pieces back up to `max_chars`.

### Chunk size / overlap behavior
Tries the coarsest split that still produces multiple pieces; only goes finer when a piece still exceeds `max_chars`. Packing recovers some continuity after aggressive splits. Hard char split is the last resort, so max observed length stays at **512**.

### Observed lengths (full corpus)
| Metric | Value |
|--------|--------|
| Total chunks (≈ Qdrant points for this strategy) | **5694** |
| Min chunk length | **5** |
| Max chunk length | **512** |
| Avg chunk length | **~296** |

### Pros
- Adapts to whatever structure the passage actually has.
- Hard upper bound on chunk size (unlike `metadata_aware` / `structure_aware` oversize sections).
- Good general-purpose “I don’t know the document shape” strategy.

### Cons
- More complex behavior to explain than fixed windows.
- No intentional overlap between adjacent hard-split pieces.
- Can produce tiny leftovers after packing.

### Recall considerations
Strong on mixed-format text (some paragraphs, some run-ons). Prefer `semantic` if you specifically want sentence integrity without char cuts.

### Noise considerations
Hard char cuts (rare, only when sentences alone exceed `max_chars`) can introduce mid-word fragments at boundaries.

### Latency considerations
**5694** points — essentially tied with `structure_aware` / `semantic`.

### Index-size implications
Similar mid-range footprint; safe to keep alongside the others in one collection.

### When to pick at query time
Use as a **robust alternative default** when passages vary wildly in formatting and you want a hard size cap.

---

## Summary (full 5000-passage corpus)

| Strategy | Chunks | Min len | Max len | Avg len |
|----------|--------|---------|---------|---------|
| `fixed_overlap` | 5465 | 65 | 550 | ~314 |
| `semantic` | 5675 | 6 | 625 | ~297 |
| `metadata_aware` | 5191 | 7 | 796 | ~325 |
| `token_window` | 5823 | 65 | 611 | ~303 |
| `structure_aware` | 5692 | 4 | 658 | ~298 |
| `recursive` | 5694 | 5 | 512 | ~296 |

Re-run measurements after changing `config.yaml` or re-ingesting:

```bash
source indexing/.venv/bin/activate
python indexing/scripts/test_chunking.py
```
