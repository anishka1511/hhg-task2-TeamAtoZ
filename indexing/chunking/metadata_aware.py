"""
metadata_aware chunking — keep whole passage when short; else split on paragraphs.

Params from config.yaml → chunking.metadata_aware.split_threshold_chars.
"""

from __future__ import annotations

import re

from .semantic import split_sentences
from ._config import load_chunking_config, make_chunk

STRATEGY = "metadata_aware"


def _params() -> int:
    return int(load_chunking_config()["metadata_aware"]["split_threshold_chars"])


def _split_paragraphs(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []

    if "\n\n" in text:
        parts = re.split(r"\n\s*\n", text)
    elif "\n" in text:
        parts = text.split("\n")
    else:
        parts = split_sentences(text)

    return [p.strip() for p in parts if p and p.strip()]


def chunk_metadata_aware(record: dict) -> list[dict]:
    threshold = _params()
    text = record["text"]

    if len(text) <= threshold:
        return [
            make_chunk(
                record,
                text,
                0,
                STRATEGY,
                extra_metadata={"para_index": 0},
            )
        ]

    segments = _split_paragraphs(text)
    if not segments:
        return []

    return [
        make_chunk(
            record,
            segment,
            i,
            STRATEGY,
            extra_metadata={"para_index": i},
        )
        for i, segment in enumerate(segments)
    ]
