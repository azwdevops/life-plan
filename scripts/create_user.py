"""
Create a new user with email and password.
Run from repo root: python scripts/create_user.py user@example.com 'your-password'
"""
import sys
import os

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_server_dir = os.path.join(_root, "server")
if _server_dir not in sys.path:
    sys.path.insert(0, _server_dir)

from core.database import SessionLocal
from core.security import get_password_hash
from models.user import User
from models.group import Group


def first_name_from_email(email: str) -> str:
    local = email.split("@", 1)[0].strip()
    if not local:
        return "User"
    return local.replace(".", " ").replace("_", " ").title()


def main() -> None:
    if len(sys.argv) != 3:
        sys.stderr.write("Usage: create_user.py <email> <password>\n")
        sys.exit(1)

    email = sys.argv[1].strip().lower()
    password = sys.argv[2]

    if not email or "@" not in email:
        sys.stderr.write("Usage: create_user.py <email> <password>\n")
        sys.stderr.write("A valid email address is required.\n")
        sys.exit(1)

    if not password:
        sys.stderr.write("Password must not be empty.\n")
        sys.exit(1)

    db = SessionLocal()
    try:
        for name in ("admin", "member"):
            if db.query(Group).filter(Group.name == name).first() is None:
                db.add(Group(name=name))
        db.commit()

        existing = db.query(User).filter(User.email == email).first()
        if existing:
            sys.stderr.write(f"A user already exists with email: {email}\n")
            sys.exit(1)

        member_group = db.query(Group).filter(Group.name == "member").first()
        assert member_group is not None

        user = User(
            email=email,
            first_name=first_name_from_email(email),
            hashed_password=get_password_hash(password),
            is_active=True,
        )
        user.groups.append(member_group)
        db.add(user)
        db.commit()
        db.refresh(user)

        sys.stdout.write(f"Created user {email} (id={user.id}).\n")
    finally:
        db.close()


if __name__ == "__main__":
    main()
