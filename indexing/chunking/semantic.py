"""
semantic chunking — sentence-aware packing under max_chars.

Params from config.yaml → chunking.semantic.max_chars.
"""

from __future__ import annotations

import logging
import re

from ._config import load_chunking_config, make_chunk

STRATEGY = "semantic"
logger = logging.getLogger(__name__)

# Fallback if nltk punkt is unavailable offline
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")


def _params() -> int:
    return int(load_chunking_config()["semantic"]["max_chars"])


def _ensure_punkt() -> bool:
    try:
        import nltk
        from nltk.data import find

        for resource in ("tokenizers/punkt_tab", "tokenizers/punkt"):
            try:
                find(resource)
                return True
            except LookupError:
                continue

        for package in ("punkt_tab", "punkt"):
            try:
                nltk.download(package, quiet=True)
            except Exception:  # noqa: BLE001
                continue
            try:
                find(f"tokenizers/{package}")
                return True
            except LookupError:
                continue
        return False
    except Exception:  # noqa: BLE001
        return False


def split_sentences(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []

    if _ensure_punkt():
        try:
            from nltk.tokenize import sent_tokenize

            sentences = [s.strip() for s in sent_tokenize(text) if s.strip()]
            if sentences:
                return sentences
        except LookupError:
            pass

    parts = [s.strip() for s in _SENTENCE_RE.split(text) if s.strip()]
    return parts if parts else [text]


def chunk_semantic(record: dict) -> list[dict]:
    max_chars = _params()
    sentences = split_sentences(record["text"])
    if not sentences:
        return []

    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        if not current:
            current = sentence
            if len(current) > max_chars:
                logger.debug(
                    "semantic: single sentence exceeds max_chars=%s (len=%s) doc_id=%s",
                    max_chars,
                    len(current),
                    record.get("doc_id"),
                )
            continue

        candidate = f"{current} {sentence}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            chunks.append(current)
            current = sentence
            if len(current) > max_chars:
                logger.debug(
                    "semantic: single sentence exceeds max_chars=%s (len=%s) doc_id=%s",
                    max_chars,
                    len(current),
                    record.get("doc_id"),
                )

    if current:
        chunks.append(current)

    return [
        make_chunk(record, piece, i, STRATEGY)
        for i, piece in enumerate(chunks)
        if piece
    ]
