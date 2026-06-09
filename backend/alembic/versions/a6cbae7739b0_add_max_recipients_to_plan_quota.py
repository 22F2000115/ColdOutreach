"""add max recipients to plan quota

Revision ID: a6cbae7739b0
Revises: e80f04f5b417
Create Date: 2026-06-08 15:07:53.854579

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a6cbae7739b0'
down_revision: Union[str, Sequence[str], None] = 'e80f04f5b417'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('plan_quotas', sa.Column('max_recipients_per_campaign', sa.Integer(), nullable=False, server_default='999999'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('plan_quotas', 'max_recipients_per_campaign')
