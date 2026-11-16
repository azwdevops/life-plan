"""add is_paused to youtube_channels and linkedin_pages

Revision ID: af92bd0fb9ca
Revises: 4471b450d23f
Create Date: 2026-11-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'af92bd0fb9ca'
down_revision: Union[str, None] = '4471b450d23f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'youtube_channels',
        sa.Column('is_paused', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column('youtube_channels', 'is_paused', server_default=None)

    op.add_column(
        'linkedin_pages',
        sa.Column('is_paused', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column('linkedin_pages', 'is_paused', server_default=None)


def downgrade() -> None:
    op.drop_column('linkedin_pages', 'is_paused')
    op.drop_column('youtube_channels', 'is_paused')
