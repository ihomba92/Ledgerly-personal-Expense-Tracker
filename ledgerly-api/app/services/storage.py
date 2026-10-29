"""Saving receipt files on disk (inside the instance/ folder by default).

Files are checked by their actual content, not just their name, so a renamed
program can't be uploaded as a "receipt.pdf".
"""
import os
import uuid
from pathlib import Path

from flask import current_app

SIGNATURES = {
    b"%PDF-": ("application/pdf", ".pdf"),
    b"\x89PNG\r\n\x1a\n": ("image/png", ".png"),
    b"\xff\xd8\xff": ("image/jpeg", ".jpg"),
}


def detect_type(head: bytes) -> tuple[str, str] | None:
    for signature, kind in SIGNATURES.items():
        if head.startswith(signature):
            return kind
    return None


def upload_root() -> Path:
    root = Path(current_app.config["UPLOAD_FOLDER"])
    root.mkdir(parents=True, exist_ok=True)
    return root


def save(user_id: uuid.UUID, data: bytes, extension: str) -> str:
    """Write the file and return its storage key, e.g. '<user id>/<random>.pdf'."""
    key = f"{user_id}/{uuid.uuid4().hex}{extension}"
    path = upload_root() / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return key


def path_for(key: str) -> Path:
    return upload_root() / key


def delete(key: str | None) -> None:
    if key:
        try:
            os.remove(path_for(key))
        except FileNotFoundError:
            pass
