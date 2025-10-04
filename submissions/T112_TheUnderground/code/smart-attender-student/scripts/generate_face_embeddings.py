#!/usr/bin/env python3
"""Generate face embeddings from student seed folders.

Usage:
    python scripts/generate_face_embeddings.py \
        --input assets/seed-faces \
        --output assets/seed-faces/embeddings

The script expects the input directory to contain one folder per student UUID.
Inside each folder, provide up to 10 photos (.jpg/.jpeg/.png). The script will
run face detection and produce:

- <student_id>.json    # embedding metadata
- <student_id>.bin     # binary float32 embeddings (N x D)
"""

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

import numpy as np

try:
    import face_recognition  # type: ignore[import]
except ImportError as exc:  # pragma: no cover - ensures helpful message
    raise SystemExit(
        'This script requires the "face_recognition" package (dlib).\n'
        'Install it with: pip install face_recognition'
    ) from exc


@dataclass
class EmbeddingResult:
    embedding: np.ndarray
    source_image: Path


def extract_face_embedding(image_path: Path) -> EmbeddingResult | None:
    """Detect the first face in the image and return a 128-d embedding."""
    image = face_recognition.load_image_file(image_path)
    boxes = face_recognition.face_locations(image, model="hog")

    if not boxes:
        # Try CNN detector if hog fails (requires GPU/dlib build)
        boxes = face_recognition.face_locations(image, model="cnn")

    if not boxes:
        return None

    encodings = face_recognition.face_encodings(image, known_face_locations=boxes)
    if not encodings:
        return None

    return EmbeddingResult(embedding=np.array(encodings[0], dtype=np.float32), source_image=image_path)


def process_student_folder(folder: Path) -> Tuple[np.ndarray, List[str]]:
    embeddings: List[np.ndarray] = []
    sources: List[str] = []

    for image_path in sorted(folder.glob("*")):
        if image_path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue

        result = extract_face_embedding(image_path)
        if result is None:
            print(f"[warn] No face detected in {image_path}")
            continue

        embeddings.append(result.embedding)
        sources.append(image_path.name)

    if not embeddings:
        raise RuntimeError(f"No embeddings produced for {folder.name}. Ensure images contain clear faces.")

    stacked = np.stack(embeddings)
    return stacked, sources


def save_embeddings(student_id: str, embeddings: np.ndarray, sources: List[str], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    metadata = {
        "studentId": student_id,
        "samples": sources,
        "numSamples": embeddings.shape[0],
        "dimension": embeddings.shape[1],
        "embeddings": embeddings.tolist(),
    }

    json_path = output_dir / f"{student_id}.json"
    json_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"[info] Saved embeddings for {student_id}: {embeddings.shape[0]} sample(s)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate face embeddings for seed students")
    parser.add_argument("--input", required=True, type=Path, help="Path to seed faces root")
    parser.add_argument("--output", required=True, type=Path, help="Path to write embeddings")
    args = parser.parse_args()

    if not args.input.exists() or not args.input.is_dir():
        raise SystemExit(f"Input directory not found: {args.input}")

    output_dir = args.output.resolve()

    for student_dir in sorted(p for p in args.input.iterdir() if p.is_dir()):
        if student_dir.resolve() == output_dir:
            # Skip the output directory if it lives under the input root
            continue

        try:
            embeddings, sources = process_student_folder(student_dir)
            save_embeddings(student_dir.name, embeddings, sources, args.output)
        except Exception as error:  # pragma: no cover - inform user for each student
            print(f"[error] Failed to process {student_dir.name}: {error}")


if __name__ == "__main__":  # pragma: no cover
    main()
