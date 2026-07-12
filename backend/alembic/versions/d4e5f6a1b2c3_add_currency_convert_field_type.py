"""add currency_convert field type

Revision ID: d4e5f6a1b2c3
Revises: c3d4e5f6a1b2
Create Date: 2026-07-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'd4e5f6a1b2c3'
down_revision: Union[str, None] = 'c3d4e5f6a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE fieldtype ADD VALUE IF NOT EXISTS 'currency_convert'")


def downgrade() -> None:
    # PostgreSQL не поддерживает удаление значений из enum
    pass
