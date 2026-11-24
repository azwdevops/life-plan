"""add ledger_items table and transaction_items.item_id

Revision ID: c7a3e9f04b12
Revises: b4e7c2a19f03
Create Date: 2026-11-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7a3e9f04b12'
down_revision: Union[str, None] = 'b4e7c2a19f03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ledger_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('ledger_id', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['ledger_id'], ['ledgers.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ledger_items_id'), 'ledger_items', ['id'], unique=False)
    op.create_index(op.f('ix_ledger_items_user_id'), 'ledger_items', ['user_id'], unique=False)
    op.create_index(op.f('ix_ledger_items_ledger_id'), 'ledger_items', ['ledger_id'], unique=False)

    op.add_column('transaction_items', sa.Column('item_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_transaction_items_item_id'), 'transaction_items', ['item_id'], unique=False)
    op.create_foreign_key(
        'fk_transaction_items_item_id_ledger_items',
        'transaction_items',
        'ledger_items',
        ['item_id'],
        ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_transaction_items_item_id_ledger_items', 'transaction_items', type_='foreignkey')
    op.drop_index(op.f('ix_transaction_items_item_id'), table_name='transaction_items')
    op.drop_column('transaction_items', 'item_id')

    op.drop_index(op.f('ix_ledger_items_ledger_id'), table_name='ledger_items')
    op.drop_index(op.f('ix_ledger_items_user_id'), table_name='ledger_items')
    op.drop_index(op.f('ix_ledger_items_id'), table_name='ledger_items')
    op.drop_table('ledger_items')
