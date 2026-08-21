"""
token_window chunking — sliding word windows with overlap.

Params from config.yaml → chunking.token_window (size_tokens, overlap_tokens).
"""

from __future__ import annotations

from ._config import load_chunking_config, make_chunk

STRATEGY = "token_window"


def _params() -> tuple[int, int]:
    cfg = load_chunking_config()["token_window"]
    return int(cfg["size_tokens"]), int(cfg["overlap_tokens"])


def _tokenize(text: str) -> list[str]:
    return text.split()


def _windows(tokens: list[str], size_tokens: int, overlap_tokens: int) -> list[str]:
    if not tokens:
        return []
    if len(tokens) <= size_tokens:
        return [" ".join(tokens)]

    step = size_tokens - overlap_tokens
    if step <= 0:
        raise ValueError(
            f"overlap_tokens ({overlap_tokens}) must be < size_tokens ({size_tokens})"
        )

    spans: list[tuple[int, int]] = []
    start = 0
    while True:
        end = min(start + size_tokens, len(tokens))
        spans.append((start, end))
        if end >= len(tokens):
            break
        start += step

    # Merge a tiny trailing remainder into the previous chunk (< ~20% of size).
    if len(spans) >= 2:
        last_start, last_end = spans[-1]
        last_len = last_end - last_start
        if last_len < 0.2 * size_tokens:
            prev_start, _ = spans[-2]
            spans = spans[:-2] + [(prev_start, last_end)]

    return [" ".join(tokens[s:e]) for s, e in spans]


def chunk_token_window(record: dict) -> list[dict]:
    size_tokens, overlap_tokens = _params()
    tokens = _tokenize(record["text"])
    pieces = _windows(tokens, size_tokens, overlap_tokens)
    return [
        make_chunk(record, piece, i, STRATEGY)
        for i, piece in enumerate(pieces)
        if piece
    ]
