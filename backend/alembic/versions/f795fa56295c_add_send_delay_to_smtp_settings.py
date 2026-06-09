"""add send delay to smtp settings

Revision ID: f795fa56295c
Revises: a6cbae7739b0
Create Date: 2026-06-08 15:08:00.035281

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f795fa56295c'
down_revision: Union[str, Sequence[str], None] = 'a6cbae7739b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('smtp_settings', sa.Column('send_delay_seconds', sa.Integer(), nullable=False, server_default='3'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('smtp_settings', 'send_delay_seconds')
