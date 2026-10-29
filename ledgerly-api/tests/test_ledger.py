"""Categories, income, expenses and the balance rule."""
import threading
from datetime import date

from conftest import expense, top_up


def balance(client, auth):
    return client.get("/api/balance", headers=auth).get_json()["balance"]


# ---------- categories ----------

def test_new_account_gets_default_categories(client, auth):
    cats = client.get("/api/categories", headers=auth).get_json()["categories"]
    assert len(cats) == 10
    assert [c["label"] for c in cats if c["is_fallback"]] == ["Other"]


def test_category_rules(client, auth):
    assert client.post("/api/categories", headers=auth, json={"label": "School fees", "icon": "school", "budget": "15000"}).status_code == 201
    dup = client.post("/api/categories", headers=auth, json={"label": "school FEES"})
    assert dup.status_code == 409 and "label" in dup.get_json()["error"]["fields"]
    bad = client.post("/api/categories", headers=auth, json={"label": "X", "icon": "rocket", "budget": "-5"})
    assert bad.status_code == 422 and set(bad.get_json()["error"]["fields"]) == {"label", "icon", "budget"}


def test_deleting_category_moves_expenses_to_other(client, auth, category_id):
    top_up(client, auth)
    e = expense(client, auth, category_id).get_json()["expense"]
    r = client.delete(f"/api/categories/{category_id}", headers=auth)
    assert r.status_code == 200 and r.get_json()["moved_expenses"] == 1
    moved = client.get(f"/api/expenses/{e['id']}", headers=auth).get_json()["expense"]
    assert moved["category_id"] == r.get_json()["moved_to"]
    assert balance(client, auth)["balance"] == "9500.00"  # money unchanged


def test_other_cannot_be_deleted(client, auth):
    cats = client.get("/api/categories", headers=auth).get_json()["categories"]
    other = next(c for c in cats if c["is_fallback"])
    assert client.delete(f"/api/categories/{other['id']}", headers=auth).status_code == 409


# ---------- income ----------

def test_first_top_up_is_the_starting_balance(client, auth):
    first = top_up(client, auth, amount="45000")["top_up"]
    second = top_up(client, auth, amount="2000", source="mpesa")["top_up"]
    assert first["kind"] == "initial" and first["note"] == "Starting balance"
    assert second["kind"] == "topup"
    assert balance(client, auth)["balance"] == "47000.00"


def test_income_list_total_and_filter(client, auth):
    top_up(client, auth, amount="45000")
    top_up(client, auth, amount="2000", source="mpesa")
    top_up(client, auth, amount="1500", source="mpesa")
    all_income = client.get("/api/top-ups", headers=auth).get_json()
    assert all_income["total"] == "48500.00" and all_income["pagination"]["total"] == 3
    mpesa = client.get("/api/top-ups?source=mpesa", headers=auth).get_json()
    assert mpesa["total"] == "3500.00" and len(mpesa["top_ups"]) == 2


def test_top_up_validation(client, auth):
    r = client.post("/api/top-ups", headers=auth, json={"amount": "12.345", "source": "lottery", "received_on": "2999-01-01"})
    assert r.status_code == 422
    assert set(r.get_json()["error"]["fields"]) == {"amount", "source", "received_on"}


def test_removing_top_up_cannot_make_balance_negative(client, auth, category_id):
    t = top_up(client, auth, amount="1000")["top_up"]
    expense(client, auth, category_id, amount="800")
    r = client.delete(f"/api/top-ups/{t['id']}", headers=auth)
    assert r.status_code == 409 and r.get_json()["error"]["reason"] == "balance_below_zero"
    assert client.patch(f"/api/top-ups/{t['id']}", headers=auth, json={"amount": "700"}).status_code == 409
    assert client.patch(f"/api/top-ups/{t['id']}", headers=auth, json={"amount": "900"}).status_code == 200


# ---------- expenses and the balance rule ----------

def test_paid_expense_reduces_balance(client, auth, category_id):
    top_up(client, auth, amount="10000")
    r = expense(client, auth, category_id, amount="450.50")
    assert r.status_code == 201
    assert r.get_json()["balance"]["balance"] == "9549.50"


def test_paid_expense_larger_than_balance_is_refused(client, auth, category_id):
    top_up(client, auth, amount="1000")
    r = expense(client, auth, category_id, amount="1500")
    err = r.get_json()["error"]
    assert r.status_code == 409 and err["reason"] == "insufficient_balance"
    assert err["details"] == {"available": "1000.00", "shortfall": "500.00"}


def test_draft_can_exceed_balance_but_cannot_be_paid(client, auth, category_id):
    top_up(client, auth, amount="1000")
    draft = expense(client, auth, category_id, amount="1500", status="draft").get_json()
    assert draft["balance"]["balance"] == "1000.00" and draft["balance"]["drafts"] == "1500.00"
    eid = draft["expense"]["id"]
    assert client.post(f"/api/expenses/{eid}/pay", headers=auth).status_code == 409
    top_up(client, auth, amount="500")
    paid = client.post(f"/api/expenses/{eid}/pay", headers=auth)
    assert paid.status_code == 200 and paid.get_json()["balance"]["balance"] == "0.00"


def test_editing_paid_amount_gives_back_the_old_amount_first(client, auth, category_id):
    top_up(client, auth, amount="1000")
    eid = expense(client, auth, category_id, amount="800").get_json()["expense"]["id"]
    assert client.patch(f"/api/expenses/{eid}", headers=auth, json={"amount": "1000"}).status_code == 200
    assert client.patch(f"/api/expenses/{eid}", headers=auth, json={"amount": "1000.01"}).status_code == 409
    to_draft = client.patch(f"/api/expenses/{eid}", headers=auth, json={"status": "draft"}).get_json()
    assert to_draft["expense"]["paid_at"] is None and to_draft["balance"]["balance"] == "1000.00"


def test_deleting_paid_expense_refunds_balance(client, auth, category_id):
    top_up(client, auth, amount="1000")
    eid = expense(client, auth, category_id, amount="300").get_json()["expense"]["id"]
    r = client.delete(f"/api/expenses/{eid}", headers=auth)
    assert r.status_code == 200 and r.get_json()["balance"]["balance"] == "1000.00"


def test_bulk_pay_is_all_or_nothing(client, auth, category_id):
    top_up(client, auth, amount="1000")
    a = expense(client, auth, category_id, amount="600", status="draft").get_json()["expense"]["id"]
    b = expense(client, auth, category_id, amount="600", status="draft").get_json()["expense"]["id"]
    assert client.post("/api/expenses/pay", headers=auth, json={"ids": [a, b]}).status_code == 409
    assert balance(client, auth)["drafts"] == "1200.00"  # nothing was paid
    assert client.post("/api/expenses/pay", headers=auth, json={"ids": [a]}).status_code == 200


def test_two_payments_at_the_same_moment_cannot_overspend(app, auth, category_id):
    """The row lock means only one of two simultaneous Ksh 700 payments fits a Ksh 1,000 balance."""
    client = app.test_client()
    top_up(client, auth, amount="1000")
    results, barrier = [], threading.Barrier(2)

    def pay():
        c = app.test_client()
        barrier.wait()
        results.append(expense(c, auth, category_id, amount="700").status_code)

    threads = [threading.Thread(target=pay) for _ in range(2)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert sorted(results) == [201, 409]
    assert balance(client, auth)["balance"] == "300.00"


def test_expense_validation(client, auth, category_id):
    r = client.post("/api/expenses", headers=auth, json={"subject": "x", "amount": "0", "category_id": "not-an-id",
                                                         "method": "bitcoin", "spent_on": "yesterday", "extra": 1})
    assert r.status_code == 422
    assert set(r.get_json()["error"]["fields"]) == {"subject", "merchant", "amount", "category_id", "method", "spent_on", "extra"}


def test_filters_search_and_paging(client, auth, category_id):
    top_up(client, auth, amount="100000")
    for i in range(25):
        expense(client, auth, category_id, amount=str(100 + i), subject=f"Item {i}",
                status="draft" if i % 5 == 0 else "paid", method="cash" if i % 2 else "mpesa")
    page2 = client.get("/api/expenses?page=2&per_page=10", headers=auth).get_json()
    assert page2["pagination"] == {"page": 2, "per_page": 10, "total": 25, "pages": 3} and len(page2["expenses"]) == 10
    drafts = client.get("/api/expenses?status=draft", headers=auth).get_json()
    assert drafts["pagination"]["total"] == 5
    assert drafts["total"] == "550.00"  # 100 + 105 + 110 + 115 + 120
    assert client.get("/api/expenses", headers=auth).get_json()["total"] == "2800.00"
    assert client.get("/api/expenses?method=cash", headers=auth).get_json()["pagination"]["total"] == 12
    assert client.get("/api/expenses?q=item 1", headers=auth).get_json()["pagination"]["total"] == 11
    top = client.get("/api/expenses?sort=amount-desc&per_page=1", headers=auth).get_json()["expenses"][0]
    assert top["amount"] == "124.00"
    assert client.get("/api/expenses?receipt=missing", headers=auth).get_json()["pagination"]["total"] == 25
    assert client.get("/api/expenses?month=2026-13", headers=auth).status_code == 422


# ---------- privacy between users ----------

def test_users_cannot_see_or_use_each_others_data(client, make_user, auth, category_id):
    top_up(client, auth)
    eid = expense(client, auth, category_id).get_json()["expense"]["id"]
    other = make_user(email="wanjiru@example.com", name="Wanjiru Kamau")
    top_up(client, other)
    assert client.get(f"/api/expenses/{eid}", headers=other).status_code == 404
    assert client.delete(f"/api/expenses/{eid}", headers=other).status_code == 404
    assert client.patch(f"/api/categories/{category_id}", headers=other, json={"budget": "1"}).status_code == 404
    stolen = expense(client, other, category_id)  # someone else's category
    assert stolen.status_code == 422 and "category_id" in stolen.get_json()["error"]["fields"]
    assert client.get("/api/expenses", headers=other).get_json()["pagination"]["total"] == 0


# ---------- reports ----------

def test_summary_and_monthly_report(client, auth, category_id):
    today = date.today()
    top_up(client, auth, amount="20000", received_on=today.isoformat())
    expense(client, auth, category_id, amount="1500")
    expense(client, auth, category_id, amount="400", status="draft")
    s = client.get("/api/summary", headers=auth).get_json()
    assert s["spent"] == "1500.00" and s["income"] == "20000.00"
    assert s["balance"]["balance"] == "18500.00"
    assert s["todo"] == {"drafts": 1, "drafts_total": "400.00", "missing_receipts": 1}
    food = next(c for c in s["categories"] if c["category_id"] == category_id)
    assert food["spent"] == "1500.00" and food["used_pct"] == 10.0 and food["status"] == "ok"
    assert len(s["daily"]) >= 28 and s["runway"]["days"] is not None
    months = client.get("/api/reports/monthly?months=3", headers=auth).get_json()["months"]
    assert len(months) == 3 and months[-1]["in"] == "20000.00" and months[-1]["out"] == "1500.00"


def test_support_request(client, auth, outbox):
    bad = client.post("/api/support-requests", headers=auth, json={"topic": "Balance", "subject": "Hi", "message": "short"})
    assert bad.status_code == 422
    r = client.post("/api/support-requests", headers=auth, json={
        "topic": "Balance & top-ups", "subject": "My balance looks wrong",
        "message": "After deleting an expense the balance did not change as I expected."})
    assert r.status_code == 201
