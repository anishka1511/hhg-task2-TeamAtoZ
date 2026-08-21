"""
Chunking strategies for Builder 1.

Usage:
    from indexing.chunking import chunk_document
    chunks = chunk_document(record, "fixed_overlap")
"""

from __future__ import annotations

from .fixed_overlap import chunk_fixed_overlap
from .metadata_aware import chunk_metadata_aware
from .recursive import chunk_recursive
from .semantic import chunk_semantic
from .structure_aware import chunk_structure_aware
from .token_window import chunk_token_window

CHUNKERS = {
    "fixed_overlap": chunk_fixed_overlap,
    "semantic": chunk_semantic,
    "metadata_aware": chunk_metadata_aware,
    "token_window": chunk_token_window,
    "structure_aware": chunk_structure_aware,
    "recursive": chunk_recursive,
}


def chunk_document(record: dict, strategy: str) -> list[dict]:
    if strategy not in CHUNKERS:
        valid = ", ".join(sorted(CHUNKERS))
        raise ValueError(
            f"Unknown chunking strategy {strategy!r}. Valid options: {valid}"
        )
    return CHUNKERS[strategy](record)


__all__ = ["CHUNKERS", "chunk_document"]
