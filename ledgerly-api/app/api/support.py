"""Messages from the Support page.

  POST /api/support-requests   {"topic": "...", "subject": "...", "message": "..."}
"""
from flask import current_app, jsonify
from flask_jwt_extended import jwt_required

from app.api import api
from app.api.helpers import current_user_id
from app.extensions import db, limiter
from app.models import SupportRequest, User
from app.schemas.ledger import SupportIn
from app.services.email import send_email
from app.validation import parse_body


@api.post("/support-requests")
@jwt_required()
@limiter.limit("5 per hour")
def create_support_request():
    data = parse_body(SupportIn)
    uid = current_user_id()
    request_row = SupportRequest(user_id=uid, topic=data.topic, subject=data.subject, message=data.message)
    db.session.add(request_row)
    db.session.commit()

    inbox = current_app.config["SUPPORT_EMAIL"]
    if inbox:  # forward to the support inbox when one is configured
        user = db.session.get(User, uid)
        text = f"From: {user.full_name} <{user.email}>\nTopic: {data.topic}\n\n{data.message}"
        send_email(inbox, f"[Ledgerly support] {data.subject}", f"<pre style='font-family:Arial'>{text}</pre>", text)

    return jsonify(message="Thanks for getting in touch. Expect a reply within one working day.",
                   id=str(request_row.id)), 201
