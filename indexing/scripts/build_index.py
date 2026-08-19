#!/usr/bin/env python3
"""
Embed chunked passages and upsert into Qdrant.

Reads knobs from indexing/config.yaml. Run from repo root:

    docker compose up -d qdrant
    python indexing/scripts/build_index.py --reset
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG_PATH = REPO_ROOT / "indexing" / "config.yaml"
STRATEGIES = ("fixed_overlap", "semantic", "metadata_aware")

REQUIRED_TOP = ("embedding_model",)
REQUIRED_QDRANT = ("collection_name", "vector_size", "distance")


def load_config(config_path: Path) -> dict:
    if not config_path.is_file():
        raise SystemExit(f"Missing config file: {config_path}")

    with config_path.open("r", encoding="utf-8") as f:
        config = yaml.safe_load(f) or {}

    for key in REQUIRED_TOP:
        if key not in config:
            raise SystemExit(f"config.yaml missing required key: {key}")

    qdrant = config.get("qdrant")
    if not isinstance(qdrant, dict):
        raise SystemExit("config.yaml missing required key: qdrant")
    for key in REQUIRED_QDRANT:
        if key not in qdrant:
            raise SystemExit(f"config.yaml missing required key: qdrant.{key}")

    paths = config.get("paths")
    if not isinstance(paths, dict) or "processed_file" not in paths:
        raise SystemExit("config.yaml missing required key: paths.processed_file")

    return config


def resolve_path(path_str: str) -> Path:
    path = Path(path_str)
    if path.is_absolute():
        return path
    return REPO_ROOT / path


def load_passages(processed_file: Path) -> list[dict]:
    if not processed_file.is_file():
        raise SystemExit(
            f"Processed passages not found at {processed_file}. "
            "Run ingest first: python indexing/scripts/ingest.py"
        )

    records: list[dict] = []
    with processed_file.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise SystemExit(
                    f"Invalid JSON on line {line_no} of {processed_file}: {exc}"
                ) from exc
    return records


def distance_enum(name: str):
    from qdrant_client.models import Distance

    mapping = {
        "Cosine": Distance.COSINE,
        "Euclid": Distance.EUCLID,
        "Dot": Distance.DOT,
    }
    if name not in mapping:
        raise SystemExit(
            f"Unsupported qdrant.distance {name!r}. "
            f"Expected one of: {', '.join(mapping)}"
        )
    return mapping[name]


def connect_qdrant(url: str, path: str | None = None):
    from qdrant_client import QdrantClient

    if path:
        # Local embedded storage (no Docker). Useful when the daemon isn't running.
        Path(path).mkdir(parents=True, exist_ok=True)
        client = QdrantClient(path=path)
        print(f"Using local Qdrant storage at {path}")
        return client

    api_key = os.environ.get("QDRANT_API_KEY") or None
    client = QdrantClient(url=url, api_key=api_key, timeout=60)
    try:
        client.get_collections()
    except Exception as exc:  # noqa: BLE001
        raise SystemExit(
            f"Qdrant is not reachable at {url}. "
            "Start it with: docker compose up -d qdrant\n"
            f"Underlying error: {exc}"
        ) from exc
    return client


def ensure_collection(client, collection_name: str, vector_size: int, distance: str, reset: bool) -> None:
    from qdrant_client.models import Distance, VectorParams

    existing = {c.name for c in client.get_collections().collections}

    if reset and collection_name in existing:
        print(f"Deleting collection {collection_name!r} (--reset)")
        client.delete_collection(collection_name)
        existing.discard(collection_name)

    if collection_name not in existing:
        print(
            f"Creating collection {collection_name!r} "
            f"(size={vector_size}, distance={distance})"
        )
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=vector_size,
                distance=distance_enum(distance),
            ),
        )
    else:
        print(f"Reusing existing collection {collection_name!r}")

    from qdrant_client.models import PayloadSchemaType
    try:
        client.create_payload_index(
            collection_name=collection_name,
            field_name="strategy",
            field_schema=PayloadSchemaType.KEYWORD,
        )
    except Exception:
        pass  # index may already exist


def point_id_for_chunk(chunk_id: str, strategy: str) -> str:
    # Include strategy so the same doc_id-cN from different strategies do not collide.
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"hhg-task2:{strategy}:{chunk_id}"))


def build_chunks(records: list[dict], strategies: list[str]) -> dict[str, list[dict]]:
    sys.path.insert(0, str(REPO_ROOT))
    from indexing.chunking import chunk_document

    by_strategy: dict[str, list[dict]] = {s: [] for s in strategies}
    skipped_empty = 0

    for record in records:
        for strategy in strategies:
            for chunk in chunk_document(record, strategy):
                text = (chunk.get("text") or "").strip()
                if not text:
                    skipped_empty += 1
                    print(
                        f"WARNING: skipping empty chunk "
                        f"{chunk.get('chunk_id')!r} strategy={strategy}",
                        file=sys.stderr,
                    )
                    continue
                # Normalize whitespace-only out; keep chunk as-is otherwise
                chunk = {**chunk, "text": text}
                by_strategy[strategy].append(chunk)

    if skipped_empty:
        print(f"Skipped {skipped_empty} empty chunk(s)")
    return by_strategy


def embed_texts(model, texts: list[str], batch_size: int):
    try:
        from tqdm import tqdm

        use_tqdm = True
    except ImportError:
        use_tqdm = False

    vectors: list[list[float]] = []
    total = len(texts)
    iterator = range(0, total, batch_size)
    if use_tqdm:
        iterator = tqdm(iterator, desc="Embedding", unit="batch")

    for start in iterator:
        batch = texts[start : start + batch_size]
        encoded = model.encode(
            batch,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        vectors.extend(encoded.tolist())
        if not use_tqdm and (start // batch_size) % 5 == 0:
            print(f"embedded {min(start + batch_size, total)}/{total} chunks")

    if not use_tqdm:
        print(f"embedded {total}/{total} chunks")
    return vectors


def upsert_chunks(
    client,
    collection_name: str,
    chunks: list[dict],
    vectors: list[list[float]],
    batch_size: int,
) -> None:
    from qdrant_client.models import PointStruct

    assert len(chunks) == len(vectors)
    points: list[PointStruct] = []

    for chunk, vector in zip(chunks, vectors):
        metadata = dict(chunk.get("metadata") or {})
        # chunk_index from chunk_id suffix "-c{N}"
        chunk_id = chunk["chunk_id"]
        try:
            chunk_index = int(chunk_id.rsplit("-c", 1)[1])
        except (IndexError, ValueError):
            chunk_index = 0

        payload = {
            "text": chunk["text"],
            "doc_id": metadata.get("doc_id", chunk_id.rsplit("-c", 1)[0]),
            "chunk_index": chunk_index,
            "strategy": chunk["strategy"],
            "chunk_id": chunk_id,
            **metadata,
        }

        points.append(
            PointStruct(
                id=point_id_for_chunk(chunk_id, chunk["strategy"]),
                vector=vector,
                payload=payload,
            )
        )

    for start in range(0, len(points), batch_size):
        batch = points[start : start + batch_size]
        client.upsert(collection_name=collection_name, points=batch)
        print(f"upserted {min(start + batch_size, len(points))}/{len(points)} points")


def count_by_strategy(client, collection_name: str, strategies: list[str]) -> dict[str, int]:
    from qdrant_client.models import FieldCondition, Filter, MatchValue

    counts: dict[str, int] = {}
    for strategy in strategies:
        result = client.count(
            collection_name=collection_name,
            count_filter=Filter(
                must=[
                    FieldCondition(
                        key="strategy",
                        match=MatchValue(value=strategy),
                    )
                ]
            ),
            exact=True,
        )
        counts[strategy] = int(result.count)
    return counts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build Qdrant index from chunked passages")
    parser.add_argument(
        "--config",
        type=Path,
        default=DEFAULT_CONFIG_PATH,
        help="Path to indexing/config.yaml",
    )
    parser.add_argument(
        "--strategy",
        choices=[*STRATEGIES, "all"],
        default="all",
        help="Which chunking strategy/strategies to index",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete and recreate the Qdrant collection before indexing",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=64,
        help="Embedding / upsert batch size",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = load_config(args.config)

    processed_file = resolve_path(config["paths"]["processed_file"])
    collection_name = config["qdrant"]["collection_name"]
    vector_size = int(config["qdrant"]["vector_size"])
    distance = config["qdrant"]["distance"]
    embedding_model = config["embedding_model"]
    qdrant_url = os.environ.get("QDRANT_URL", "http://localhost:6333")
    qdrant_path = os.environ.get("QDRANT_PATH")  # optional local embedded mode

    strategies = list(STRATEGIES) if args.strategy == "all" else [args.strategy]

    records = load_passages(processed_file)
    print(f"Loaded {len(records)} passages from {processed_file}")

    by_strategy = build_chunks(records, strategies)
    for strategy, chunks in by_strategy.items():
        print(f"  {strategy}: {len(chunks)} chunks")

    client = connect_qdrant(qdrant_url, path=qdrant_path)
    ensure_collection(client, collection_name, vector_size, distance, reset=args.reset)

    print(f"Loading embedding model {embedding_model!r} …")
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(embedding_model)
    # Sanity-check dim vs config
    probe = model.encode(["dim check"], normalize_embeddings=True)
    actual_dim = int(probe.shape[1])
    if actual_dim != vector_size:
        raise SystemExit(
            f"Embedding dim {actual_dim} != qdrant.vector_size {vector_size} in config.yaml"
        )

    for strategy in strategies:
        chunks = by_strategy[strategy]
        if not chunks:
            print(f"WARNING: no chunks for strategy={strategy}, skipping")
            continue
        print(f"\n=== Indexing strategy={strategy} ({len(chunks)} chunks) ===")
        texts = [c["text"] for c in chunks]
        vectors = embed_texts(model, texts, args.batch_size)
        upsert_chunks(client, collection_name, chunks, vectors, args.batch_size)

    print("\n=== Collection point counts (Qdrant ground truth) ===")
    counts = count_by_strategy(client, collection_name, list(STRATEGIES))
    total = 0
    for strategy, count in counts.items():
        print(f"  {strategy}: {count}")
        total += count
    info = client.get_collection(collection_name)
    print(f"  collection total points: {info.points_count}")
    print(f"  sum of strategy filters: {total}")

    missing = [s for s in strategies if counts.get(s, 0) <= 0]
    if missing:
        raise SystemExit(
            f"Expected >0 points for strategies {missing}, got {counts}"
        )


if __name__ == "__main__":
    main()
