"""add contact details table

Revision ID: 52a1b9b4f98c
Revises: 9751b13e4ffb
Create Date: 2026-06-04 16:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '52a1b9b4f98c'
down_revision: Union[str, Sequence[str], None] = '9751b13e4ffb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    if 'contact_details' not in tables:
        op.create_table(
            'contact_details',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('type', sa.String(), nullable=False),
            sa.Column('value', sa.String(), nullable=False),
            sa.Column('label', sa.String(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_contact_details_id'), 'contact_details', ['id'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    if 'contact_details' in tables:
        op.drop_index(op.f('ix_contact_details_id'), table_name='contact_details')
        op.drop_table('contact_details')

