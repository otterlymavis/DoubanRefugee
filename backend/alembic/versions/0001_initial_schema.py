"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-27
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The application models are the source of truth for this scaffold. Generate
    # the concrete migration with `alembic revision --autogenerate` after the
    # production database URL is configured.
    pass


def downgrade() -> None:
    pass

