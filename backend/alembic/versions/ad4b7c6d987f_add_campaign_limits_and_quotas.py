"""add campaign limits and quotas

Revision ID: ad4b7c6d987f
Revises: 52a1b9b4f98c
Create Date: 2026-06-04 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ad4b7c6d987f'
down_revision: Union[str, Sequence[str], None] = '52a1b9b4f98c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create plan_quotas table
    op.create_table(
        'plan_quotas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('plan', sa.String(), nullable=False),
        sa.Column('add_limit', sa.Integer(), nullable=False, server_default='999999'),
        sa.Column('edit_limit', sa.Integer(), nullable=False, server_default='999999'),
        sa.Column('delete_limit', sa.Integer(), nullable=False, server_default='999999'),
        sa.Column('save_limit', sa.Integer(), nullable=False, server_default='999999'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('plan')
    )
    op.create_index(op.f('ix_plan_quotas_id'), 'plan_quotas', ['id'], unique=False)
    op.create_index(op.f('ix_plan_quotas_plan'), 'plan_quotas', ['plan'], unique=True)

    # Add columns to users table
    op.add_column('users', sa.Column('campaign_add_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('campaign_edit_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('campaign_delete_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('campaign_save_count', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    # Drop columns from users table
    op.drop_column('users', 'campaign_save_count')
    op.drop_column('users', 'campaign_delete_count')
    op.drop_column('users', 'campaign_edit_count')
    op.drop_column('users', 'campaign_add_count')

    # Drop plan_quotas table
    op.drop_index(op.f('ix_plan_quotas_plan'), table_name='plan_quotas')
    op.drop_index(op.f('ix_plan_quotas_id'), table_name='plan_quotas')
    op.drop_table('plan_quotas')
