#!/usr/bin/env python3
"""
Ingest a laptop-sized MSMARCO-XI English-passage subset into JSONL.

Reads knobs from indexing/config.yaml. Run from repo root:

    python indexing/scripts/ingest.py

Note: The HF hub currently exposes only BuilderConfig "default" (all languages,
~55GB). Language subsets are parquet shards (e.g. train/hintrain.parquet).
This script downloads the shard named by paths/hf_data_file in config.yaml and
streams the first subset_query_rows with pyarrow — it does not materialize the
full multi-language default split.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG_PATH = REPO_ROOT / "indexing" / "config.yaml"

REQUIRED_TOP_LEVEL = (
    "hf_dataset",
    "hf_config",
    "hf_split",
    "hf_data_file",
    "subset_query_rows",
    "max_unique_passages",
    "min_unique_passages_target",
)

WHITESPACE_RE = re.compile(r"\s+")


def load_config(config_path: Path) -> dict:
    if not config_path.is_file():
        raise SystemExit(f"Missing config file: {config_path}")

    with config_path.open("r", encoding="utf-8") as f:
        config = yaml.safe_load(f) or {}

    for key in REQUIRED_TOP_LEVEL:
        if key not in config:
            raise SystemExit(f"config.yaml missing required key: {key}")

    paths = config.get("paths")
    if not isinstance(paths, dict):
        raise SystemExit("config.yaml missing required key: paths")
    if "processed_file" not in paths:
        raise SystemExit("config.yaml missing required key: paths.processed_file")
    if "raw_cache_dir" not in paths:
        raise SystemExit("config.yaml missing required key: paths.raw_cache_dir")

    return config


def normalize_text(text: str) -> str:
    return WHITESPACE_RE.sub(" ", text).strip()


def text_hash(normalized: str) -> str:
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def resolve_path(path_str: str) -> Path:
    path = Path(path_str)
    if path.is_absolute():
        return path
    return REPO_ROOT / path


def download_shard(config: dict) -> Path:
    """Download the language parquet shard into raw_cache_dir; return local path."""
    from huggingface_hub import hf_hub_download

    hf_dataset = config["hf_dataset"]
    hf_data_file = config["hf_data_file"]
    local_dir = resolve_path(config["paths"]["raw_cache_dir"])
    local_dir.mkdir(parents=True, exist_ok=True)

    try:
        path = hf_hub_download(
            repo_id=hf_dataset,
            filename=hf_data_file,
            repo_type="dataset",
            local_dir=str(local_dir),
        )
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            f"Failed to load {hf_dataset} with config '{config['hf_config']}' "
            f"(data file '{hf_data_file}'): {exc}"
        ) from exc

    return Path(path)


def iter_query_rows(parquet_path: Path, limit: int):
    """
    Yield row dicts for the first `limit` queries.

    Uses batch_size=1 because this parquet's nested `passages` struct fails
    Arrow conversion for larger chunked batches on current pyarrow.
    """
    import pyarrow.parquet as pq

    pf = pq.ParquetFile(parquet_path)
    columns = ["query_id", "query_type", "target_lang", "passages"]
    count = 0
    for batch in pf.iter_batches(batch_size=1, columns=columns, use_threads=False):
        rows = batch.to_pylist()
        if not rows:
            continue
        yield rows[0]
        count += 1
        if count >= limit:
            break


def ingest(config: dict, limit_override: int | None = None) -> None:
    subset_query_rows = int(config["subset_query_rows"])
    max_unique_passages = int(config["max_unique_passages"])
    min_unique_passages_target = int(config["min_unique_passages_target"])
    processed_file = resolve_path(config["paths"]["processed_file"])

    if limit_override is not None:
        subset_query_rows = min(subset_query_rows, int(limit_override))

    parquet_path = download_shard(config)
    print(
        f"Using shard {config['hf_data_file']} "
        f"(logical hf_config={config['hf_config']!r}) at {parquet_path}"
    )

    seen_hashes: set[str] = set()
    written: list[dict] = []

    total_query_rows_scanned = 0
    total_passage_candidates = 0
    total_empty = 0
    total_duplicates = 0
    capped = False

    for row in iter_query_rows(parquet_path, subset_query_rows):
        total_query_rows_scanned += 1
        query_id = row.get("query_id")

        try:
            passages = row["passages"]
            english_passages = passages["English_passages"]
            is_selected = passages["is_selected"]
            query_type = row["query_type"]
            target_lang = row["target_lang"]
            query_id = row["query_id"]
        except (KeyError, TypeError) as exc:
            print(
                f"WARNING: skipping malformed row query_id={query_id!r}: {exc}",
                file=sys.stderr,
            )
            continue

        if english_passages is None or is_selected is None:
            print(
                f"WARNING: skipping row query_id={query_id!r}: missing passages lists",
                file=sys.stderr,
            )
            continue

        if len(english_passages) != len(is_selected):
            print(
                f"WARNING: skipping row query_id={query_id!r}: "
                f"English_passages len={len(english_passages)} != "
                f"is_selected len={len(is_selected)}",
                file=sys.stderr,
            )
            continue

        for i, (text, sel) in enumerate(zip(english_passages, is_selected)):
            total_passage_candidates += 1

            if text is None:
                total_empty += 1
                continue

            normalized = normalize_text(str(text))
            if not normalized:
                total_empty += 1
                continue

            digest = text_hash(normalized)
            if digest in seen_hashes:
                total_duplicates += 1
                continue

            if capped or len(written) >= max_unique_passages:
                capped = True
                # Still scan remaining rows for duplicate stats of already-seen text;
                # do not write additional unique passages past the cap.
                continue

            seen_hashes.add(digest)
            written.append(
                {
                    "doc_id": f"{query_id}-{i}",
                    "text": normalized,
                    "query_id": int(query_id) if query_id is not None else query_id,
                    "query_type": query_type,
                    "is_selected": int(sel) if sel is not None else 0,
                    "target_lang": target_lang,
                }
            )

    processed_file.parent.mkdir(parents=True, exist_ok=True)
    with processed_file.open("w", encoding="utf-8") as out:
        for record in written:
            out.write(json.dumps(record, ensure_ascii=False) + "\n")

    unique_count = len(written)

    print("=== Ingest summary ===")
    print(f"total query rows scanned:     {total_query_rows_scanned}")
    print(f"total passage candidates:     {total_passage_candidates}")
    print(f"total dropped empty:          {total_empty}")
    print(f"total dropped duplicates:     {total_duplicates}")
    print(f"total unique records written: {unique_count}")
    print(f"output file:                  {processed_file}")
    if capped:
        print(f"(capped at max_unique_passages={max_unique_passages})")

    if unique_count < min_unique_passages_target:
        print(
            f"WARNING: unique records ({unique_count}) below "
            f"min_unique_passages_target ({min_unique_passages_target}). "
            "Consider increasing subset_query_rows in indexing/config.yaml.",
            file=sys.stderr,
        )

    print("\n=== Sample records (first 5) ===")
    for record in written[:5]:
        print(json.dumps(record, indent=2, ensure_ascii=False))
        print("---")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest MSMARCO-XI English passages")
    parser.add_argument(
        "--config",
        type=Path,
        default=DEFAULT_CONFIG_PATH,
        help="Path to indexing/config.yaml",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional override: max query rows (still capped by config subset_query_rows)",
    )
    args = parser.parse_args()

    config = load_config(args.config)
    ingest(config, limit_override=args.limit)


if __name__ == "__main__":
    main()
