"""
Chunking strategies for Builder 1.

Usage:
    from indexing.chunking import chunk_document
    chunks = chunk_document(record, "fixed_overlap")
"""

from __future__ import annotations

from .fixed_overlap import chunk_fixed_overlap
from .metadata_aware import chunk_metadata_aware
from .semantic import chunk_semantic

CHUNKERS = {
    "fixed_overlap": chunk_fixed_overlap,
    "semantic": chunk_semantic,
    "metadata_aware": chunk_metadata_aware,
}


def chunk_document(record: dict, strategy: str) -> list[dict]:
    if strategy not in CHUNKERS:
        valid = ", ".join(sorted(CHUNKERS))
        raise ValueError(
            f"Unknown chunking strategy {strategy!r}. Valid options: {valid}"
        )
    return CHUNKERS[strategy](record)


__all__ = ["CHUNKERS", "chunk_document"]
