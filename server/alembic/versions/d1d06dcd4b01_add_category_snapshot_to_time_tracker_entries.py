"""add category snapshot to time tracker entries and active sessions

Revision ID: d1d06dcd4b01
Revises: 0887c57300a2
Create Date: 2026-11-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1d06dcd4b01'
down_revision: Union[str, None] = '0887c57300a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('time_tracker_entries', sa.Column('category_id', sa.Integer(), nullable=True))
    op.add_column('time_tracker_entries', sa.Column('category_name', sa.String(length=512), nullable=True))
    op.create_index(op.f('ix_time_tracker_entries_category_id'), 'time_tracker_entries', ['category_id'], unique=False)
    op.create_foreign_key(
        'fk_tt_entries_category_id_tt_categories',
        'time_tracker_entries', 'time_tracker_categories', ['category_id'], ['id'], ondelete='SET NULL',
    )

    op.add_column('time_tracker_active_sessions', sa.Column('category_id', sa.Integer(), nullable=True))
    op.add_column('time_tracker_active_sessions', sa.Column('category_name', sa.String(length=512), nullable=True))
    op.create_index(op.f('ix_time_tracker_active_sessions_category_id'), 'time_tracker_active_sessions', ['category_id'], unique=False)
    op.create_foreign_key(
        'fk_tt_active_sessions_category_id_tt_categories',
        'time_tracker_active_sessions', 'time_tracker_categories', ['category_id'], ['id'], ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_tt_active_sessions_category_id_tt_categories', 'time_tracker_active_sessions', type_='foreignkey')
    op.drop_index(op.f('ix_time_tracker_active_sessions_category_id'), table_name='time_tracker_active_sessions')
    op.drop_column('time_tracker_active_sessions', 'category_name')
    op.drop_column('time_tracker_active_sessions', 'category_id')

    op.drop_constraint('fk_tt_entries_category_id_tt_categories', 'time_tracker_entries', type_='foreignkey')
    op.drop_index(op.f('ix_time_tracker_entries_category_id'), table_name='time_tracker_entries')
    op.drop_column('time_tracker_entries', 'category_name')
    op.drop_column('time_tracker_entries', 'category_id')
