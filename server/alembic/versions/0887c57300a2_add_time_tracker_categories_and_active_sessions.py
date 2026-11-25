"""add time tracker categories and active sessions

Revision ID: 0887c57300a2
Revises: c7a3e9f04b12
Create Date: 2026-11-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0887c57300a2'
down_revision: Union[str, None] = 'c7a3e9f04b12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'time_tracker_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('name', sa.String(length=512), nullable=False),
        sa.Column('name_key', sa.String(length=512), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name_key', name='uq_time_tracker_categories_user_name_key'),
    )
    op.create_index(op.f('ix_time_tracker_categories_id'), 'time_tracker_categories', ['id'], unique=False)
    op.create_index(op.f('ix_time_tracker_categories_user_id'), 'time_tracker_categories', ['user_id'], unique=False)

    op.add_column('time_tracker_projects', sa.Column('category_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_time_tracker_projects_category_id'), 'time_tracker_projects', ['category_id'], unique=False)
    op.create_foreign_key(
        'fk_time_tracker_projects_category_id_time_tracker_categories',
        'time_tracker_projects', 'time_tracker_categories', ['category_id'], ['id'], ondelete='SET NULL',
    )

    op.create_table(
        'time_tracker_active_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=16), nullable=False),
        sa.Column('goal_id', sa.Integer(), nullable=True),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('subject_name', sa.String(length=512), nullable=False),
        sa.Column('parent_goal_id', sa.String(length=512), nullable=True),
        sa.Column('parent_goal_name', sa.String(length=512), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('accumulated_pause_ms', sa.Integer(), nullable=False),
        sa.Column('pause_started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['goal_id'], ['time_tracker_goals.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['project_id'], ['time_tracker_projects.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_time_tracker_active_sessions_user_id'),
    )
    op.create_index(op.f('ix_time_tracker_active_sessions_id'), 'time_tracker_active_sessions', ['id'], unique=False)
    op.create_index(op.f('ix_time_tracker_active_sessions_user_id'), 'time_tracker_active_sessions', ['user_id'], unique=False)
    op.create_index(op.f('ix_time_tracker_active_sessions_goal_id'), 'time_tracker_active_sessions', ['goal_id'], unique=False)
    op.create_index(op.f('ix_time_tracker_active_sessions_project_id'), 'time_tracker_active_sessions', ['project_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_time_tracker_active_sessions_project_id'), table_name='time_tracker_active_sessions')
    op.drop_index(op.f('ix_time_tracker_active_sessions_goal_id'), table_name='time_tracker_active_sessions')
    op.drop_index(op.f('ix_time_tracker_active_sessions_user_id'), table_name='time_tracker_active_sessions')
    op.drop_index(op.f('ix_time_tracker_active_sessions_id'), table_name='time_tracker_active_sessions')
    op.drop_table('time_tracker_active_sessions')

    op.drop_constraint('fk_time_tracker_projects_category_id_time_tracker_categories', 'time_tracker_projects', type_='foreignkey')
    op.drop_index(op.f('ix_time_tracker_projects_category_id'), table_name='time_tracker_projects')
    op.drop_column('time_tracker_projects', 'category_id')

    op.drop_index(op.f('ix_time_tracker_categories_user_id'), table_name='time_tracker_categories')
    op.drop_index(op.f('ix_time_tracker_categories_id'), table_name='time_tracker_categories')
    op.drop_table('time_tracker_categories')
