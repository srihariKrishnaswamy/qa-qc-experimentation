"""Convert a PDF to a list of JPEG image paths (one per page)."""

import sys
import tempfile
from pathlib import Path

from pdf2image import convert_from_path


def pdf_to_images(pdf_path: str | Path) -> list[Path]:
    """
    Convert each page of a PDF to a JPEG in a temp directory.
    Returns a list of image paths (page_1.jpg, page_2.jpg, ...).
    The temp dir is not auto-deleted; caller can remove it when done.
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {path}")
    if path.suffix.lower() != ".pdf":
        raise ValueError(f"Not a PDF file: {path}")

    tmpdir = tempfile.mkdtemp(prefix="ai_pipeline_pages_")
    out_dir = Path(tmpdir)
    images = convert_from_path(str(path), fmt="jpeg")
    result: list[Path] = []
    for i, img in enumerate(images, start=1):
        out_path = out_dir / f"page_{i}.jpg"
        img.save(out_path, "JPEG")
        result.append(out_path)
    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python processor.py <path/to/spec.pdf>", file=sys.stderr)
        sys.exit(1)
    pdf_path = sys.argv[1]
    paths = pdf_to_images(pdf_path)
    for p in paths:
        print(p)
