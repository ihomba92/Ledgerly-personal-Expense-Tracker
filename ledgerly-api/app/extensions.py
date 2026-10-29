"""Flask extensions, created once and connected to the app in create_app()."""
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

from app.database import Base

cors = CORS()
db = SQLAlchemy(model_class=Base)  # db.session is how the app reads and writes data
migrate = Migrate()               # adds the `flask db ...` migration commands
jwt = JWTManager()                # creates and checks login tokens
limiter = Limiter(key_func=get_remote_address)  # counts requests per IP address
