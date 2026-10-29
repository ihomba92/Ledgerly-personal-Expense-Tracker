"""Receipt files (PDF, PNG or JPEG, up to 15 MB), one per expense.

  POST   /api/expenses/<id>/receipt   upload (form field "file"); replaces any existing receipt
  GET    /api/expenses/<id>/receipt   download
  DELETE /api/expenses/<id>/receipt   remove
"""
import logging

from flask import abort, jsonify, request, send_file
from flask_jwt_extended import jwt_required

from app.api import api
from app.api.helpers import get_owned
from app.api.serializers import receipt_json
from app.extensions import db
from app.models import Expense, Receipt
from app.models.receipt import MAX_BYTES
from app.services import storage

log = logging.getLogger("ledgerly.ledger")


@api.post("/expenses/<expense_id>/receipt")
@jwt_required()
def upload_receipt(expense_id):
    expense = get_owned(Expense, expense_id, "expense")
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        abort(400, description="Choose a file to upload (form field “file”).")
    data = upload.read(MAX_BYTES + 1)
    if not data:
        abort(400, description="That file is empty.")
    if len(data) > MAX_BYTES:
        abort(413, description="That file is over 15 MB. Upload a smaller copy.")
    kind = storage.detect_type(data[:16])
    if kind is None:
        log.warning("Receipt upload refused for expense %s: not a PDF, PNG or JPEG", expense.id)
        abort(415, description="Upload a PDF, PNG or JPG file.")
    mime_type, extension = kind

    old_key = expense.receipt.storage_key if expense.receipt else None
    if expense.receipt:
        db.session.delete(db.session.get(Receipt, expense.receipt.id))
        db.session.flush()
    key = storage.save(expense.user_id, data, extension)
    name = (upload.filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1] or f"receipt{extension}")[:255]
    receipt = Receipt(expense_id=expense.id, user_id=expense.user_id, file_name=name, mime_type=mime_type,
                      size_bytes=len(data), storage_key=key)
    db.session.add(receipt)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        storage.delete(key)
        raise
    storage.delete(old_key)
    log.info("Receipt uploaded for expense %s (%s, %d bytes)", expense.id, mime_type, len(data))
    return jsonify(receipt=receipt_json(receipt)), 201


@api.get("/expenses/<expense_id>/receipt")
@jwt_required()
def download_receipt(expense_id):
    expense = get_owned(Expense, expense_id, "expense")
    if expense.receipt is None:
        abort(404, description="This expense has no receipt.")
    path = storage.path_for(expense.receipt.storage_key)
    if not path.exists():
        abort(404, description="The receipt file is missing.")
    return send_file(path, mimetype=expense.receipt.mime_type, download_name=expense.receipt.file_name)


@api.delete("/expenses/<expense_id>/receipt")
@jwt_required()
def delete_receipt(expense_id):
    expense = get_owned(Expense, expense_id, "expense")
    if expense.receipt is None:
        abort(404, description="This expense has no receipt.")
    key = expense.receipt.storage_key
    db.session.delete(db.session.get(Receipt, expense.receipt.id))
    db.session.commit()
    storage.delete(key)
    return jsonify(message="Receipt removed.")
