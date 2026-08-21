#!/usr/bin/env python3
"""
Validate chunking strategies on ingested passages.

Run from repo root:

    python indexing/scripts/test_chunking.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from indexing.chunking import CHUNKERS, chunk_document  # noqa: E402

PROCESSED = REPO_ROOT / "indexing" / "data" / "processed" / "passages.jsonl"
STRATEGIES = list(CHUNKERS.keys())


def load_records(path: Path, limit: int | None = None) -> list[dict]:
    records: list[dict] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            records.append(json.loads(line))
            if limit is not None and len(records) >= limit:
                break
    return records


def main() -> None:
    if not PROCESSED.is_file():
        raise SystemExit(
            f"Missing {PROCESSED}. Run: python indexing/scripts/ingest.py"
        )

    sample = load_records(PROCESSED, limit=10)
    print(f"Loaded {len(sample)} sample records from {PROCESSED}")

    sample_counts: dict[str, int] = {}
    for strategy in STRATEGIES:
        total = 0
        for record in sample:
            chunks = chunk_document(record, strategy)
            total += len(chunks)
            for chunk in chunks:
                assert chunk["strategy"] == strategy
                assert chunk["chunk_id"].startswith(record["doc_id"] + "-c")
                assert "doc_id" in chunk["metadata"]
                assert "query_id" in chunk["metadata"]
        sample_counts[strategy] = total
        print(f"  {strategy}: {total} chunks on first 10 docs")

    unique_counts = set(sample_counts.values())
    if len(unique_counts) == 1:
        print(
            "NOTE: all strategies produced the same chunk count on these 10 "
            "documents — sample passages are under every strategy's threshold "
            "(or otherwise chunk identically). Chunking behavior will diverge on "
            "longer passages elsewhere in the dataset."
        )
    else:
        print(
            "OK: chunk counts differ across strategies on the 10-document sample "
            f"→ {sample_counts}"
        )

    # Full-corpus stats for docs/CHUNKING.md
    all_records = load_records(PROCESSED)
    print(f"\nFull corpus: {len(all_records)} passages")
    for strategy in STRATEGIES:
        lengths: list[int] = []
        n_chunks = 0
        for record in all_records:
            chunks = chunk_document(record, strategy)
            n_chunks += len(chunks)
            lengths.extend(len(c["text"]) for c in chunks)
        print(
            f"  {strategy}: chunks={n_chunks} "
            f"min_len={min(lengths)} max_len={max(lengths)} "
            f"avg_len={sum(lengths) / len(lengths):.1f}"
        )


if __name__ == "__main__":
    main()
