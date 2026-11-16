"""add linkedin posting tracker tables

Revision ID: 4471b450d23f
Revises: afb43f716b0d
Create Date: 2026-11-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4471b450d23f'
down_revision: Union[str, None] = 'afb43f716b0d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'linkedin_pages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_linkedin_pages_id'), 'linkedin_pages', ['id'], unique=False)
    op.create_index(op.f('ix_linkedin_pages_user_id'), 'linkedin_pages', ['user_id'], unique=False)

    op.create_table(
        'linkedin_page_posting_times',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('page_id', sa.Integer(), nullable=False),
        sa.Column('day_of_week', sa.String(length=9), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=True),
        sa.Column('end_time', sa.Time(), nullable=True),
        sa.Column('is_posting_day', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['page_id'], ['linkedin_pages.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('page_id', 'day_of_week', name='uq_linkedin_posting_times_page_day'),
    )
    op.alter_column('linkedin_page_posting_times', 'is_posting_day', server_default=None)
    op.create_index(
        op.f('ix_linkedin_page_posting_times_id'), 'linkedin_page_posting_times', ['id'], unique=False
    )
    op.create_index(
        op.f('ix_linkedin_page_posting_times_page_id'), 'linkedin_page_posting_times', ['page_id'], unique=False
    )

    op.create_table(
        'linkedin_page_post_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('page_id', sa.Integer(), nullable=False),
        sa.Column('post_date', sa.Date(), nullable=False),
        sa.Column('posts_count', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['page_id'], ['linkedin_pages.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('page_id', 'post_date', name='uq_linkedin_post_logs_page_date'),
    )
    op.create_index(op.f('ix_linkedin_page_post_logs_id'), 'linkedin_page_post_logs', ['id'], unique=False)
    op.create_index(
        op.f('ix_linkedin_page_post_logs_page_id'), 'linkedin_page_post_logs', ['page_id'], unique=False
    )
    op.create_index(
        op.f('ix_linkedin_page_post_logs_post_date'), 'linkedin_page_post_logs', ['post_date'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_linkedin_page_post_logs_post_date'), table_name='linkedin_page_post_logs')
    op.drop_index(op.f('ix_linkedin_page_post_logs_page_id'), table_name='linkedin_page_post_logs')
    op.drop_index(op.f('ix_linkedin_page_post_logs_id'), table_name='linkedin_page_post_logs')
    op.drop_table('linkedin_page_post_logs')

    op.drop_index(op.f('ix_linkedin_page_posting_times_page_id'), table_name='linkedin_page_posting_times')
    op.drop_index(op.f('ix_linkedin_page_posting_times_id'), table_name='linkedin_page_posting_times')
    op.drop_table('linkedin_page_posting_times')

    op.drop_index(op.f('ix_linkedin_pages_user_id'), table_name='linkedin_pages')
    op.drop_index(op.f('ix_linkedin_pages_id'), table_name='linkedin_pages')
    op.drop_table('linkedin_pages')
