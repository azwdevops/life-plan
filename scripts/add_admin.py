"""
Add a user to the admin group by email.
Run from repo root: python scripts/add_admin.py user@example.com
"""
import sys
import os

# Ensure server directory is on path (life-plan/server)
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_server_dir = os.path.join(_root, "server")
if _server_dir not in sys.path:
    sys.path.insert(0, _server_dir)

from core.database import SessionLocal
from models.user import User
from models.group import Group


def main() -> None:
    if len(sys.argv) != 2:
        sys.stderr.write("Usage: add_admin.py <email>\n")
        sys.exit(1)

    email = sys.argv[1].strip()
    if not email:
        sys.stderr.write("Usage: add_admin.py <email>\n")
        sys.exit(1)

    db = SessionLocal()
    try:
        # Ensure admin (and member) groups exist — create if missing (migration doesn't seed them)
        for name in ("admin", "member"):
            if db.query(Group).filter(Group.name == name).first() is None:
                db.add(Group(name=name))
        db.commit()

        user = db.query(User).filter(User.email == email).first()
        if not user:
            sys.stderr.write(f"No user found with email: {email}\n")
            sys.exit(1)

        admin_group = db.query(Group).filter(Group.name == "admin").first()
        assert admin_group is not None  # we just ensured it exists

        if admin_group in user.groups:
            sys.stderr.write(f"{email} is already in the admin group.\n")
            sys.exit(0)

        user.groups.append(admin_group)
        db.commit()
        sys.stdout.write(f"Added {email} to the admin group.\n")
    finally:
        db.close()


if __name__ == "__main__":
    main()
