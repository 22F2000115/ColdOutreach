"""add activity log

Revision ID: 9791334a568b
Revises: 8253b6b51381
Create Date: 2026-06-06 10:46:37.585204

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9791334a568b'
down_revision: Union[str, Sequence[str], None] = '8253b6b51381'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

