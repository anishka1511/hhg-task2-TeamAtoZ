# Indexing — Builder 1

Dataset: [ai4bharat/MSMARCO-XI](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI)

## Status (scaffold)

Scripts below are stubs. Implement in order:

1. `scripts/ingest.py` — download/subset + normalize  
2. `chunking/*.py` — ≥3 strategies  
3. `scripts/build_index.py` — embed + upsert to Qdrant  

## Local Qdrant

From repo root:

```bash
docker compose up -d qdrant
```

UI/API: http://localhost:6333

## Config

See `config.yaml` and root `.env.example`.
