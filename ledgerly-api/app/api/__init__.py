"""All API routes live under /api, grouped in one blueprint."""
from flask import Blueprint

api = Blueprint("api", __name__, url_prefix="/api")

# Importing the route modules registers their routes on the blueprint.
from app.api import account, auth, categories, expenses, health, oauth, receipts, reports, support, top_ups  # noqa: E402,F401
