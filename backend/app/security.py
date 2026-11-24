import hashlib
import hmac
import os
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from dotenv import load_dotenv

from .database import REPOSITORY_ROOT

JWT_ALGORITHM = "HS256"
DEFAULT_ACCESS_TOKEN_MINUTES = 60
MIN_JWT_SECRET_LENGTH = 32

SCRYPT_N = 16384
SCRYPT_R = 8
SCRYPT_P = 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Check a password against a `scrypt$n$r$p$salt$digest` hash in constant time."""
    try:
        algorithm, n, r, p, salt, digest = stored_hash.split("$")
        if algorithm != "scrypt":
            return False
        candidate = hashlib.scrypt(
            password.encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p)
        )
        return hmac.compare_digest(candidate, bytes.fromhex(digest))
    except (ValueError, TypeError):
        return False


# Verified against when a username does not exist so that response time does not reveal it.
DUMMY_PASSWORD_HASH = hash_password("timing-equalisation-only")


def get_jwt_secret() -> str:
    load_dotenv(REPOSITORY_ROOT / ".env")
    secret = os.getenv("JWT_SECRET", "")
    if len(secret) < MIN_JWT_SECRET_LENGTH:
        raise RuntimeError(
            f"Set JWT_SECRET (at least {MIN_JWT_SECRET_LENGTH} characters) in the repository "
            "root .env before using authentication."
        )
    return secret


def create_access_token(user_id: int) -> str:
    minutes = int(os.getenv("ACCESS_TOKEN_MINUTES", str(DEFAULT_ACCESS_TOKEN_MINUTES)))
    now = datetime.now(UTC)
    claims = {"sub": str(user_id), "iat": now, "exp": now + timedelta(minutes=minutes)}
    return jwt.encode(claims, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> int | None:
    """Return the user id from a valid, unexpired token, otherwise None."""
    try:
        claims = jwt.decode(
            token, get_jwt_secret(), algorithms=[JWT_ALGORITHM], options={"require": ["exp", "sub"]}
        )
        return int(claims["sub"])
    except (jwt.PyJWTError, ValueError):
        return None


# Characters that are easy to confuse when read aloud or typed (0/O, 1/l/I) are left out.
TEMPORARY_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
TEMPORARY_PASSWORD_LENGTH = 14


def generate_temporary_password() -> str:
    return "".join(
        secrets.choice(TEMPORARY_PASSWORD_ALPHABET) for _ in range(TEMPORARY_PASSWORD_LENGTH)
    )
