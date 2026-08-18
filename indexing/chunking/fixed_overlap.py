"""
fixed_overlap chunking — sliding character windows with overlap.

Params from config.yaml → chunking.fixed_overlap (size_chars, overlap_chars).
"""

from __future__ import annotations

from ._config import load_chunking_config, make_chunk

STRATEGY = "fixed_overlap"


def _params() -> tuple[int, int]:
    cfg = load_chunking_config()["fixed_overlap"]
    return int(cfg["size_chars"]), int(cfg["overlap_chars"])


def _windows(text: str, size_chars: int, overlap_chars: int) -> list[str]:
    if len(text) <= size_chars:
        return [text]

    step = size_chars - overlap_chars
    if step <= 0:
        raise ValueError(
            f"overlap_chars ({overlap_chars}) must be < size_chars ({size_chars})"
        )

    spans: list[tuple[int, int]] = []
    start = 0
    while True:
        end = min(start + size_chars, len(text))
        spans.append((start, end))
        if end >= len(text):
            break
        start += step

    # Merge a tiny trailing remainder into the previous chunk (< ~20% of size).
    if len(spans) >= 2:
        last_start, last_end = spans[-1]
        last_len = last_end - last_start
        if last_len < 0.2 * size_chars:
            prev_start, _ = spans[-2]
            spans = spans[:-2] + [(prev_start, last_end)]

    return [text[s:e] for s, e in spans]


def chunk_fixed_overlap(record: dict) -> list[dict]:
    size_chars, overlap_chars = _params()
    pieces = _windows(record["text"], size_chars, overlap_chars)
    return [
        make_chunk(record, piece, i, STRATEGY)
        for i, piece in enumerate(pieces)
        if piece
    ]
