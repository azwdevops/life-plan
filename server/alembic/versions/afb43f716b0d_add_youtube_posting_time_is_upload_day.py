"""add is_upload_day to youtube_channel_posting_times

Revision ID: afb43f716b0d
Revises: a9a61018d78e
Create Date: 2026-11-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'afb43f716b0d'
down_revision: Union[str, None] = 'a9a61018d78e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'youtube_channel_posting_times',
        sa.Column('is_upload_day', sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.alter_column('youtube_channel_posting_times', 'is_upload_day', server_default=None)


def downgrade() -> None:
    op.drop_column('youtube_channel_posting_times', 'is_upload_day')
