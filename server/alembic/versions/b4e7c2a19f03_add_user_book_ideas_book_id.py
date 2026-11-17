"""add book_ideas_book_id to users

Revision ID: b4e7c2a19f03
Revises: af92bd0fb9ca
Create Date: 2026-11-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4e7c2a19f03'
down_revision: Union[str, None] = 'af92bd0fb9ca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('book_ideas_book_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_users_book_ideas_book_id_azw_books',
        'users',
        'azw_books',
        ['book_ideas_book_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_users_book_ideas_book_id_azw_books', 'users', type_='foreignkey')
    op.drop_column('users', 'book_ideas_book_id')
