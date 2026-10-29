"""How each row is turned into JSON for the React app. Amounts are strings like "450.50"."""
from app.money import money


def category_json(c, spent_cents: int | None = None, expense_count: int | None = None) -> dict:
    body = {"id": str(c.id), "label": c.label, "icon": c.icon, "budget": money(c.budget_cents),
            "budget_cents": c.budget_cents, "is_fallback": c.is_fallback}
    if spent_cents is not None:
        pct = round(spent_cents / c.budget_cents * 100, 1) if c.budget_cents else None
        status = None if pct is None else "over" if pct > 100 else "near" if pct >= 85 else "ok"
        body |= {"spent": money(spent_cents), "spent_cents": spent_cents, "used_pct": pct, "status": status,
                 "expense_count": expense_count or 0}
    return body


def top_up_json(t) -> dict:
    return {"id": str(t.id), "amount": money(t.amount_cents), "amount_cents": t.amount_cents, "source": t.source.value,
            "kind": t.kind.value, "received_on": t.received_on.isoformat(), "note": t.note,
            "created_at": t.created_at.isoformat()}


def receipt_json(r) -> dict | None:
    if r is None:
        return None
    return {"id": str(r.id), "file_name": r.file_name, "mime_type": r.mime_type, "size_bytes": r.size_bytes,
            "uploaded_at": r.uploaded_at.isoformat()}


def expense_json(e) -> dict:
    return {"id": str(e.id), "subject": e.subject, "merchant": e.merchant, "amount": money(e.amount_cents),
            "amount_cents": e.amount_cents, "category_id": str(e.category_id), "method": e.method.value,
            "status": e.status.value, "spent_on": e.spent_on.isoformat(), "note": e.note,
            "paid_at": e.paid_at.isoformat() if e.paid_at else None, "receipt": receipt_json(e.receipt),
            "created_at": e.created_at.isoformat(), "updated_at": e.updated_at.isoformat()}
