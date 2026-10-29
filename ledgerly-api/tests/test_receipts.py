"""Receipt uploads: type and size checks, replacing, downloading and cleaning up files."""
import io
from pathlib import Path

from conftest import expense, top_up

PDF = b"%PDF-1.4\n% test receipt\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def upload(client, auth, eid, data, name):
    return client.post(f"/api/expenses/{eid}/receipt", headers=auth,
                       data={"file": (io.BytesIO(data), name)}, content_type="multipart/form-data")


def stored_files(app):
    root = Path(app.config["UPLOAD_FOLDER"])
    return [p for p in root.rglob("*") if p.is_file()] if root.exists() else []


def test_upload_download_replace_and_delete(app, client, auth, category_id):
    top_up(client, auth)
    eid = expense(client, auth, category_id).get_json()["expense"]["id"]

    r = upload(client, auth, eid, PDF, "naivas.pdf")
    assert r.status_code == 201 and r.get_json()["receipt"]["mime_type"] == "application/pdf"
    got = client.get(f"/api/expenses/{eid}/receipt", headers=auth)
    assert got.status_code == 200 and got.data == PDF

    assert upload(client, auth, eid, PNG, "photo.png").status_code == 201  # replaces the PDF
    assert len(stored_files(app)) == 1
    listed = client.get(f"/api/expenses/{eid}", headers=auth).get_json()["expense"]["receipt"]
    assert listed["file_name"] == "photo.png"

    assert client.delete(f"/api/expenses/{eid}", headers=auth).status_code == 200
    assert stored_files(app) == []  # deleting the expense removes the file too


def test_rejects_fake_and_empty_files(client, auth, category_id):
    top_up(client, auth)
    eid = expense(client, auth, category_id).get_json()["expense"]["id"]
    assert upload(client, auth, eid, b"MZ\x90\x00 not really a pdf", "receipt.pdf").status_code == 415
    assert upload(client, auth, eid, b"", "empty.pdf").status_code == 400


def test_other_users_cannot_upload_or_download(client, make_user, auth, category_id):
    top_up(client, auth)
    eid = expense(client, auth, category_id).get_json()["expense"]["id"]
    upload(client, auth, eid, PDF, "mine.pdf")
    other = make_user(email="wanjiru@example.com", name="Wanjiru Kamau")
    assert client.get(f"/api/expenses/{eid}/receipt", headers=other).status_code == 404
    assert upload(client, other, eid, PDF, "theirs.pdf").status_code == 404
