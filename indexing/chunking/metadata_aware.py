"""
metadata-aware chunking — STUB (Builder 1)

Respect document/field boundaries; store metadata on each chunk.
"""

from __future__ import annotations


def chunk_record(record: dict) -> list[dict]:
    """
    TODO(Builder 1): split while preserving metadata (doc_id, language, etc.).
    Return list of {text, metadata}.
    """
    raise NotImplementedError("metadata-aware chunking not implemented")
