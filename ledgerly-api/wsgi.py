"""Entry point used by `flask run` (development) and by a production server such as gunicorn."""
from dotenv import load_dotenv

load_dotenv()  # read .env before the app reads its settings

from app import create_app  # noqa: E402

app = create_app()
