"""create templates table

Revision ID: e80f04f5b417
Revises: 9791334a568b
Create Date: 2026-06-06 22:12:27.261790

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e80f04f5b417'
down_revision: Union[str, Sequence[str], None] = '9791334a568b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old unused email_templates table safely
    try:
        op.drop_index('ix_email_templates_id', table_name='email_templates')
    except Exception:
        pass
    try:
        op.drop_table('email_templates')
    except Exception:
        pass

    # Ensure templates table has the variables column
    try:
        op.add_column('templates', sa.Column('variables', sa.String(), nullable=True))
    except Exception:
        pass

    # Drop old user column safely
    try:
        op.drop_column('users', 'sender_profile')
    except Exception:
        pass


def downgrade() -> None:
    pass
