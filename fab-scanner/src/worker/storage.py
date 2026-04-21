"""Storage client abstraction.

The worker needs two Storage operations:
  1. Download the uploaded STL/SVG for a given revision's storage_path.
  2. Upload a rendered thumbnail to the fabrication-thumbnails bucket.

Phase 2A-1 only needs (1). (2) arrives in Phase 2A-5 when thumbnail
rendering lands. Method signatures are in place so scan_runner can be
written end-to-end without blocking on 2A-5.
"""

from __future__ import annotations

from typing import Protocol


class StorageClient(Protocol):
    """Minimum surface the scanner needs for file IO."""

    def download_fixture(self, storage_path: str) -> bytes:
        """Read the raw bytes of an uploaded STL/SVG.

        In prod: calls Supabase Storage via signed URL (15-min TTL).
        In tests: returns the bytes of a local fixture file.

        Raises FileNotFoundError if the path doesn't exist in the bucket.
        """
        ...

    def upload_thumbnail(
        self,
        job_revision_id: str,
        png_bytes: bytes,
        content_type: str = "image/png",
    ) -> str:
        """Write a PNG to fabrication-thumbnails/, return the storage path.

        Phase 2A-5 wires the caller; for now scan_runner does not invoke
        this method.
        """
        ...
