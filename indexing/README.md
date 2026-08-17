# Indexing — dataset plan (Builder 1)

This document describes **what data we pull, how much, why, and where the processed output will live**. Numeric knobs live only in [`config.yaml`](./config.yaml) — if a size changes, update the config; do not duplicate those numbers here.

Corpus source: [ai4bharat/MSMARCO-XI](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI).

This build indexes **English passages only** (`passages.English_passages`). Translated passages are out of scope.

---

## Load the dataset

Logical language id and split come from `config.yaml` (`hf_config`, `hf_split`).

The Hugging Face Hub currently exposes only BuilderConfig `"default"` (all languages combined). Calling `load_dataset(..., "hi")` as shown in older dataset-card snippets fails with `BuilderConfig 'hi' not found`. For this build we load the **Hindi train parquet shard** named by `hf_data_file` in `config.yaml` (e.g. `train/hintrain.parquet`) via `huggingface_hub.hf_hub_download`, then stream the first `subset_query_rows` with pyarrow. That keeps downloads to one language file instead of the full multi-lang default split.

`English_passages` is still the MS MARCO English text; `target_lang` on Hindi rows is e.g. `"hin_Deva"`.

Equivalent idea (shard path must match `hf_data_file`):

```python
from huggingface_hub import hf_hub_download
import pyarrow.parquet as pq

path = hf_hub_download(
    repo_id="ai4bharat/MSMARCO-XI",
    filename="train/hintrain.parquet",  # = hf_data_file in config.yaml
    repo_type="dataset",
)
# Then iterate first N rows with pq.ParquetFile(path).iter_batches(...)
```

Each row includes:

| Field | Notes |
|-------|--------|
| `query` | Translated query string |
| `query_id` | Integer id |
| `query_type` | e.g. `"DESCRIPTION"` |
| `Eng_Query` | Original English query |
| `Eng_Answer` | Original English answer |
| `target_lang` | e.g. `"hin_Deva"` — constant for a given language shard |
| `passages.English_passages` | `list[str]` — **this is what we index** |
| `passages.is_selected` | `list[int]` (0/1), same length/order as `English_passages` |

`English_passages` text is the same underlying MS MARCO English text across language shards. Only translated fields differ. We picked Hindi (`hf_config: "hi"` / `hf_data_file: train/hintrain.parquet`) arbitrarily.

---

## Subset selection

In plain English, the ingest pipeline (once `scripts/ingest.py` exists) will:

1. Open the HF split configured in `config.yaml` (`hf_dataset` / `hf_config` / `hf_split`).
2. Take only the **first** `subset_query_rows` query rows from that split (see `config.yaml` for the current value).
3. For each of those rows, **explode** every string in `passages.English_passages` into its own passage record (keep `is_selected` aligned by list index when writing metadata).
4. **Dedupe** passages by **exact text match** so the same English string appearing under many queries is stored once.
5. **Cap** the unique set at `max_unique_passages` (hard limit for laptop-friendly indexing).
6. If the unique count after dedup is below `min_unique_passages_target`, log a **warning** (soft floor — do not fail the run solely for that).

**Why:** Full MSMARCO-XI is huge. A capped English-passage subset is enough to demonstrate multi-strategy chunking + Qdrant retrieval without blowing disk or index time.

**Eventual processed output:** one JSONL file at the path given by `paths.processed_file` in `config.yaml` (today: `indexing/data/processed/passages.jsonl`). Each line will be one unique English passage record (ids/metadata defined by later ingest work). Raw/HF cache material belongs under `paths.raw_cache_dir`.

---

## Disk / RAM expectations

At the order of magnitude controlled by `max_unique_passages` in `config.yaml` (thousands of passages, each a few hundred characters on average):

- Raw passage text is only a **few MB**.
- MiniLM vectors at 384 dims (`float32`) are roughly `N × 384 × 4` bytes — on the order of **~7–8 MB** of vectors when `N` is near the configured cap.
- Practical takeaway: **under ~100 MB total** for this subset’s text + vectors on disk (excluding HF download cache). Disk space should not be a concern for a laptop demo.

HF may still download larger shards into the raw cache directory the first time you load the dataset; that cache is separate from the processed JSONL size above.

---

## License / attribution

MSMARCO-XI is derived from **MS MARCO** (Microsoft) via **AI4Bharat**’s Indic translation effort: https://huggingface.co/datasets/ai4bharat/MSMARCO-XI — this build uses it for a **non-commercial hackathon demo**.

---

## Scaling later

To grow the corpus later, raise `subset_query_rows` and/or `max_unique_passages` in `config.yaml` (and re-run ingest + index). For larger pulls, switch `load_dataset` to `streaming=True` so you are not forced to materialize the full split in RAM. If translated-passage retrieval were ever added (out of scope for this build), you could load additional language configs; English-only indexing would stay as documented here.

---

## Reproduce

Once later tasks fill in the scripts, a teammate would run (from repo root), using values from `config.yaml`:

1. Create a Python venv and install indexing deps:  
   `python -m venv indexing/.venv && source indexing/.venv/bin/activate && pip install -r indexing/requirements.txt`
2. Start local Qdrant:  
   `docker compose up -d qdrant`
3. Ingest the subset into the processed JSONL path from `config.yaml`:  
   `python indexing/scripts/ingest.py`
4. Confirm output exists at `paths.processed_file` (see `config.yaml`) and that unique passage count is between the configured soft floor and hard cap (or note the warning if below the floor).
5. Build the Qdrant index (later task):  
   `python indexing/scripts/build_index.py --reset`

Until those scripts exist beyond ingest, treat this README + `config.yaml` as the contract for what ingest must do.

---

## Sample records

Printed by `python indexing/scripts/ingest.py` (first 5 unique passages written):

```json
{
  "doc_id": "1185869-0",
  "text": "The presence of communication amid scientific minds was equally important to the success of the Manhattan Project as scientific intellect was. The only cloud hanging over the impressive achievement of the atomic researchers and engineers is what their success truly meant; hundreds of thousands of innocent lives obliterated.",
  "query_id": 1185869,
  "query_type": "DESCRIPTION",
  "is_selected": 1,
  "target_lang": "hin_Deva"
}
```

```json
{
  "doc_id": "1185869-1",
  "text": "The Manhattan Project and its atomic bomb helped bring an end to World War II. Its legacy of peaceful uses of atomic energy continues to have an impact on history and science.",
  "query_id": 1185869,
  "query_type": "DESCRIPTION",
  "is_selected": 0,
  "target_lang": "hin_Deva"
}
```

```json
{
  "doc_id": "1185869-2",
  "text": "Essay on The Manhattan Project - The Manhattan Project The Manhattan Project was to see if making an atomic bomb possible. The success of this project would forever change the world forever making it known that something this powerful can be manmade.",
  "query_id": 1185869,
  "query_type": "DESCRIPTION",
  "is_selected": 0,
  "target_lang": "hin_Deva"
}
```

```json
{
  "doc_id": "1185869-3",
  "text": "The Manhattan Project was the name for a project conducted during World War II, to develop the first atomic bomb. It refers specifically to the period of the project from 194 … 2-1946 under the control of the U.S. Army Corps of Engineers, under the administration of General Leslie R. Groves.",
  "query_id": 1185869,
  "query_type": "DESCRIPTION",
  "is_selected": 0,
  "target_lang": "hin_Deva"
}
```

```json
{
  "doc_id": "1185869-4",
  "text": "versions of each volume as well as complementary websites. The first website–The Manhattan Project: An Interactive History–is available on the Office of History and Heritage Resources website, http://www.cfo. doe.gov/me70/history. The Office of History and Heritage Resources and the National Nuclear Security",
  "query_id": 1185869,
  "query_type": "DESCRIPTION",
  "is_selected": 0,
  "target_lang": "hin_Deva"
}
```
