"""Password hashing with bcrypt.

bcrypt turns a password into a one-way hash. We store only the hash, so even
someone who reads the database can't see anyone's password.
"""
import bcrypt

# A real hash of a random password. Used when an email isn't found, so a failed
# login takes the same time either way and attackers can't tell which emails exist.
_DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str | None) -> bool:
    hashed = password_hash.encode("utf-8") if password_hash else _DUMMY_HASH
    matches = bcrypt.checkpw(password.encode("utf-8"), hashed)
    return matches and password_hash is not None
