"""add_new_field_types

Revision ID: a1b2c3d4e5f6
Revises: db6e3e525afe
Create Date: 2026-05-20 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'db6e3e525afe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE fieldtype ADD VALUE IF NOT EXISTS 'image'")
    op.execute("ALTER TYPE fieldtype ADD VALUE IF NOT EXISTS 'price'")
    op.execute("ALTER TYPE fieldtype ADD VALUE IF NOT EXISTS 'autoincrement'")
    op.execute("ALTER TYPE fieldtype ADD VALUE IF NOT EXISTS 'formula'")
    op.execute("ALTER TYPE fieldtype ADD VALUE IF NOT EXISTS 'warehouse_location'")
    op.execute("ALTER TYPE fieldtype ADD VALUE IF NOT EXISTS 'file'")
    op.execute("ALTER TYPE fieldtype ADD VALUE IF NOT EXISTS 'status'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values — manual intervention required
    pass
