"""The bell (notifications) and profile pictures."""
import io
from datetime import date
from pathlib import Path

from PIL import Image

from conftest import PASSWORD, expense, top_up


def bell(client, headers):
    return client.get("/api/notifications", headers=headers).get_json()


def kinds(client, headers):
    return [n["kind"] for n in bell(client, headers)["notifications"]]


# ---------- notifications ----------

def test_new_account_gets_a_welcome(client, auth):
    data = bell(client, auth)
    assert data["unread_count"] == 1 and data["notifications"][0]["kind"] == "welcome"
    assert data["notifications"][0]["link"] == "/app/wallet"


def test_budget_warning_at_85_then_over_and_no_repeats(client, auth, category_id):
    top_up(client, auth, amount="100000", received_on=date.today().isoformat())
    expense(client, auth, category_id, amount="12000")             # Food budget is 15,000: 80%, no alert
    assert "budget_near" not in kinds(client, auth)
    expense(client, auth, category_id, amount="1000")              # 86.7%
    near = [n for n in bell(client, auth)["notifications"] if n["kind"] == "budget_near"]
    assert len(near) == 1 and near[0]["title"] == "Food & groceries is at 86% of its budget"
    assert "Ksh 2,000.00 left" in near[0]["body"]
    expense(client, auth, category_id, amount="500")               # still near: no second warning
    assert kinds(client, auth).count("budget_near") == 1
    expense(client, auth, category_id, amount="2000")              # 103%: over
    expense(client, auth, category_id, amount="100")               # still over: no repeat
    assert kinds(client, auth).count("budget_over") == 1


def test_budget_alerts_respect_the_setting(client, auth, category_id):
    client.patch("/api/auth/me", headers=auth, json={"notify_budget": False})
    top_up(client, auth, amount="100000", received_on=date.today().isoformat())
    expense(client, auth, category_id, amount="16000")
    assert "budget_over" not in kinds(client, auth)


def test_drafts_do_not_alert_until_paid(client, auth, category_id):
    top_up(client, auth, amount="100000", received_on=date.today().isoformat())
    draft = expense(client, auth, category_id, amount="16000", status="draft").get_json()["expense"]
    assert "budget_over" not in kinds(client, auth)
    client.post(f"/api/expenses/{draft['id']}/pay", headers=auth)
    assert "budget_over" in kinds(client, auth)


def test_low_balance_alert(client, auth, category_id):
    cats = client.get("/api/categories", headers=auth).get_json()["categories"]
    rent = next(c["id"] for c in cats if c["label"] == "Rent & housing")
    top_up(client, auth, amount="20000", received_on=date.today().isoformat())
    expense(client, auth, rent, amount="17000")                    # 3,000 left: 15%, fine
    assert "low_balance" not in kinds(client, auth)
    expense(client, auth, rent, amount="1500")                     # 1,500 left: 7.5%
    low = [n for n in bell(client, auth)["notifications"] if n["kind"] == "low_balance"][0]
    assert low["body"].startswith("Ksh 1,500.00 left")


def test_password_change_creates_security_notice(client, auth):
    r = client.post("/api/auth/change-password", headers=auth, json={"current_password": PASSWORD, "new_password": "Fresh2026x"})
    headers = {"Authorization": f"Bearer {r.get_json()['access_token']}"}
    assert bell(client, headers)["notifications"][0]["title"] == "Password changed"


def test_read_read_all_and_delete(client, auth, category_id):
    top_up(client, auth, amount="100000", received_on=date.today().isoformat())
    expense(client, auth, category_id, amount="16000")
    data = bell(client, auth)
    assert data["unread_count"] == 2
    first = data["notifications"][0]["id"]
    r = client.post(f"/api/notifications/{first}/read", headers=auth).get_json()
    assert r["notification"]["read"] is True and r["unread_count"] == 1
    assert client.post("/api/notifications/read-all", headers=auth).get_json()["unread_count"] == 0
    assert client.delete(f"/api/notifications/{first}", headers=auth).status_code == 200
    assert len(bell(client, auth)["notifications"]) == 1


def test_others_cannot_touch_my_notifications(client, auth, make_user):
    mine = bell(client, auth)["notifications"][0]["id"]
    other = make_user(email="wanjiru@example.com", name="Wanjiru Kamau")
    assert client.post(f"/api/notifications/{mine}/read", headers=other).status_code == 404
    assert client.delete(f"/api/notifications/{mine}", headers=other).status_code == 404


# ---------- profile picture ----------

def jpeg_with_gps(width=1200, height=800) -> bytes:
    image = Image.new("RGB", (width, height), (20, 66, 45))
    exif = Image.Exif()
    exif[0x010F] = "PhoneMaker"                                   # camera make
    exif[0x8825] = {1: "S", 2: (1.0, 17.0, 0.0), 3: "E", 4: (36.0, 49.0, 0.0)}  # GPS: Nairobi
    out = io.BytesIO()
    image.save(out, "JPEG", exif=exif)
    return out.getvalue()


def upload(client, headers, data, name="me.jpg"):
    return client.post("/api/auth/me/avatar", headers=headers, data={"file": (io.BytesIO(data), name)},
                       content_type="multipart/form-data")


def test_upload_cleans_resizes_and_serves_the_picture(app, client, auth):
    original = jpeg_with_gps()
    assert Image.open(io.BytesIO(original)).getexif().get_ifd(0x8825)  # the test photo really has GPS
    r = upload(client, auth, original)
    user = r.get_json()["user"]
    assert r.status_code == 200 and user["has_avatar"] is True and user["avatar_version"]
    got = client.get("/api/auth/me/avatar", headers=auth)
    assert got.status_code == 200 and got.mimetype == "image/webp"
    stored = Image.open(io.BytesIO(got.data))
    assert stored.format == "WEBP" and stored.size == (256, 256)
    assert not stored.getexif() and "exif" not in stored.info        # no GPS or camera details kept


def test_replacing_and_removing_the_picture_cleans_up_files(app, client, auth):
    folder = Path(app.config["UPLOAD_FOLDER"])
    upload(client, auth, jpeg_with_gps())
    upload(client, auth, jpeg_with_gps(400, 400))
    me = client.get("/api/auth/me", headers=auth).get_json()["user"]
    files = [p for p in folder.rglob("*.webp")]
    assert len(files) == 1                                         # the old picture was deleted
    assert client.delete("/api/auth/me/avatar", headers=auth).get_json()["user"]["has_avatar"] is False
    assert list(folder.rglob("*.webp")) == [] and client.get("/api/auth/me/avatar", headers=auth).status_code == 404


def test_rejects_non_images_and_oversized_files(client, auth):
    assert upload(client, auth, b"MZ not an image", "me.png").status_code == 422
    gif = io.BytesIO(); Image.new("RGB", (10, 10)).save(gif, "GIF")
    assert upload(client, auth, gif.getvalue(), "me.gif").status_code == 422
    assert upload(client, auth, b"x" * (5 * 1024 * 1024 + 1), "big.jpg").status_code == 422


def test_rejects_decompression_bombs(client, auth):
    bomb = io.BytesIO()
    Image.new("1", (7000, 7000)).save(bomb, "PNG")                 # 49 megapixels in a tiny file
    assert len(bomb.getvalue()) < 100_000
    r = upload(client, auth, bomb.getvalue(), "bomb.png")
    assert r.status_code == 422 and "file" in r.get_json()["error"]["fields"]
