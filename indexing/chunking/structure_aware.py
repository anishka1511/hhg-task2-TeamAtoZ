"""
structure_aware chunking — split on headings / list markers; else paragraphs.

Params from config.yaml → chunking.structure_aware.max_chars.
"""

from __future__ import annotations

import re

from .semantic import split_sentences
from ._config import load_chunking_config, make_chunk

STRATEGY = "structure_aware"

# Lines that look like structural breaks in web/passage text.
_HEADING_RE = re.compile(
    r"^(?:"
    r"#{1,6}\s+.+"  # markdown heading
    r"|[A-Z][A-Z0-9 /&:,\-]{2,60}$"  # short ALL-CAPS title line
    r"|(?:\d+[\.\)]\s+\S.+)"  # numbered list item
    r"|(?:[-*•]\s+\S.+)"  # bullet list item
    r")$"
)


def _params() -> int:
    return int(load_chunking_config()["structure_aware"]["max_chars"])


def _looks_structural(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    return bool(_HEADING_RE.match(stripped))


def _split_structure(text: str) -> list[str]:
    """Split into sections keyed by structural lines; fall back to paragraphs."""
    text = text.strip()
    if not text:
        return []

    lines = text.split("\n")
    structural_hits = sum(1 for line in lines if _looks_structural(line))
    if structural_hits == 0:
        if "\n\n" in text:
            parts = re.split(r"\n\s*\n", text)
        elif "\n" in text:
            parts = text.split("\n")
        else:
            parts = split_sentences(text)
        return [p.strip() for p in parts if p and p.strip()]

    sections: list[str] = []
    current: list[str] = []

    for line in lines:
        if _looks_structural(line) and current:
            sections.append("\n".join(current).strip())
            current = [line.strip()]
        else:
            if line.strip() or current:
                current.append(line.rstrip())

    if current:
        joined = "\n".join(current).strip()
        if joined:
            sections.append(joined)

    return sections


def _pack_sections(sections: list[str], max_chars: int) -> list[str]:
    """Greedily pack short sections; leave oversize sections as their own chunk."""
    chunks: list[str] = []
    current = ""

    for section in sections:
        if not current:
            current = section
            continue
        candidate = f"{current}\n\n{section}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            chunks.append(current)
            current = section

    if current:
        chunks.append(current)
    return chunks


def chunk_structure_aware(record: dict) -> list[dict]:
    max_chars = _params()
    text = record["text"]
    sections = _split_structure(text)
    if not sections:
        return []

    # Short passages with no useful structure: one chunk.
    if len(sections) == 1 and len(sections[0]) <= max_chars:
        return [
            make_chunk(
                record,
                sections[0],
                0,
                STRATEGY,
                extra_metadata={"section_index": 0},
            )
        ]

    pieces = _pack_sections(sections, max_chars)
    return [
        make_chunk(
            record,
            piece,
            i,
            STRATEGY,
            extra_metadata={"section_index": i},
        )
        for i, piece in enumerate(pieces)
        if piece
    ]
