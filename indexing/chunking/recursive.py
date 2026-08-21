"""
recursive chunking — hierarchical split until pieces fit under max_chars.

Order: double newline → single newline → sentences → hard character windows.

Params from config.yaml → chunking.recursive.max_chars.
"""

from __future__ import annotations

import re

from .semantic import split_sentences
from ._config import load_chunking_config, make_chunk

STRATEGY = "recursive"


def _params() -> int:
    return int(load_chunking_config()["recursive"]["max_chars"])


def _hard_char_split(text: str, max_chars: int) -> list[str]:
    if len(text) <= max_chars:
        return [text] if text else []
    pieces: list[str] = []
    start = 0
    while start < len(text):
        pieces.append(text[start : start + max_chars])
        start += max_chars
    return pieces


def _split_once(text: str, level: int) -> list[str]:
    text = text.strip()
    if not text:
        return []

    if level == 0:
        parts = re.split(r"\n\s*\n", text)
    elif level == 1:
        parts = text.split("\n")
    elif level == 2:
        parts = split_sentences(text)
    else:
        return []

    return [p.strip() for p in parts if p and p.strip()]


def _recursive_split(text: str, max_chars: int, level: int = 0) -> list[str]:
    text = text.strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    if level > 2:
        return _hard_char_split(text, max_chars)

    parts = _split_once(text, level)
    # No useful split at this level → try deeper.
    if len(parts) <= 1:
        return _recursive_split(text, max_chars, level + 1)

    out: list[str] = []
    for part in parts:
        if len(part) <= max_chars:
            out.append(part)
        else:
            out.extend(_recursive_split(part, max_chars, level + 1))
    return out


def _pack(pieces: list[str], max_chars: int) -> list[str]:
    """Merge adjacent undersized pieces without exceeding max_chars."""
    if not pieces:
        return []

    chunks: list[str] = []
    current = ""
    for piece in pieces:
        if not current:
            current = piece
            continue
        sep = " " if "\n" not in piece and "\n" not in current else "\n"
        candidate = f"{current}{sep}{piece}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            chunks.append(current)
            current = piece
    if current:
        chunks.append(current)
    return chunks


def chunk_recursive(record: dict) -> list[dict]:
    max_chars = _params()
    pieces = _recursive_split(record["text"], max_chars)
    packed = _pack(pieces, max_chars)
    return [
        make_chunk(record, piece, i, STRATEGY)
        for i, piece in enumerate(packed)
        if piece
    ]
