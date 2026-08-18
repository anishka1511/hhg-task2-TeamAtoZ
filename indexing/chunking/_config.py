"""Shared helpers for chunking strategies — load config from indexing/config.yaml."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = REPO_ROOT / "indexing" / "config.yaml"


@lru_cache(maxsize=1)
def load_chunking_config() -> dict:
    with CONFIG_PATH.open("r", encoding="utf-8") as f:
        config = yaml.safe_load(f) or {}
    chunking = config.get("chunking")
    if not isinstance(chunking, dict):
        raise RuntimeError(f"config.yaml missing chunking section: {CONFIG_PATH}")
    return chunking


def base_metadata(record: dict) -> dict:
    return {
        "doc_id": record["doc_id"],
        "query_id": record["query_id"],
        "query_type": record["query_type"],
        "is_selected": record["is_selected"],
        "target_lang": record["target_lang"],
    }


def make_chunk(
    record: dict,
    text: str,
    index: int,
    strategy: str,
    extra_metadata: dict | None = None,
) -> dict:
    metadata = base_metadata(record)
    if extra_metadata:
        metadata.update(extra_metadata)
    return {
        "chunk_id": f"{record['doc_id']}-c{index}",
        "text": text,
        "metadata": metadata,
        "strategy": strategy,
    }
