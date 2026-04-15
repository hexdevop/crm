"""user company_id nullable

Revision ID: 0002
Revises: 0001
Create Date: 2024-04-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('users', 'company_id',
               existing_type=UUID(),
               nullable=True)


def downgrade() -> None:
    op.alter_column('users', 'company_id',
               existing_type=UUID(),
               nullable=False)
