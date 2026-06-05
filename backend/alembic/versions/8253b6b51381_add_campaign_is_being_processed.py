"""add_campaign_is_being_processed

Revision ID: 8253b6b51381
Revises: ad4b7c6d987f
Create Date: 2026-06-05 11:36:48.453559

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8253b6b51381'
down_revision: Union[str, Sequence[str], None] = 'ad4b7c6d987f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("campaigns",
        sa.Column("is_being_processed", sa.Boolean(),
                  nullable=False, server_default="0")
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("campaigns", "is_being_processed")

