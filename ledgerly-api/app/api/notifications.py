"""The bell.

  GET    /api/notifications                newest first (up to 50) with unread_count
  POST   /api/notifications/<id>/read      mark one as read
  POST   /api/notifications/read-all       mark all as read
  DELETE /api/notifications/<id>           remove one
"""
from datetime import datetime, timezone

from flask import jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func, select, update

from app.api import api
from app.api.helpers import current_user_id, get_owned
from app.extensions import db
from app.models import Notification


def notification_json(n) -> dict:
    return {"id": str(n.id), "kind": n.kind.value, "title": n.title, "body": n.body, "link": n.link,
            "read": n.read_at is not None, "created_at": n.created_at.isoformat()}


def _unread(uid) -> int:
    return db.session.scalar(select(func.count()).where(Notification.user_id == uid, Notification.read_at.is_(None)))


@api.get("/notifications")
@jwt_required()
def list_notifications():
    uid = current_user_id()
    rows = db.session.scalars(select(Notification).where(Notification.user_id == uid)
                              .order_by(Notification.created_at.desc()).limit(50)).all()
    return jsonify(notifications=[notification_json(n) for n in rows], unread_count=_unread(uid))


@api.post("/notifications/<notification_id>/read")
@jwt_required()
def read_notification(notification_id):
    n = get_owned(Notification, notification_id, "notification")
    if n.read_at is None:
        n.read_at = datetime.now(timezone.utc)
        db.session.commit()
    return jsonify(notification=notification_json(n), unread_count=_unread(n.user_id))


@api.post("/notifications/read-all")
@jwt_required()
def read_all_notifications():
    uid = current_user_id()
    db.session.execute(update(Notification).where(Notification.user_id == uid, Notification.read_at.is_(None))
                       .values(read_at=datetime.now(timezone.utc)))
    db.session.commit()
    return jsonify(unread_count=0)


@api.delete("/notifications/<notification_id>")
@jwt_required()
def delete_notification(notification_id):
    n = get_owned(Notification, notification_id, "notification")
    uid = n.user_id
    db.session.delete(n)
    db.session.commit()
    return jsonify(unread_count=_unread(uid))
