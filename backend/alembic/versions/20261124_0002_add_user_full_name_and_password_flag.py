"""add user full name and must-change-password flag

Revision ID: 20261124_0002
Revises: 20261116_0001
Create Date: 2026-11-24 09:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel

from alembic import op

revision: str = "20261124_0002"
down_revision: str | None = "20261116_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Both columns are safe for existing rows: full_name is nullable and the flag defaults to
    # false, so nobody is forced to change a password when this migration is applied.
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column("full_name", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=True)
        )
        batch_op.add_column(
            sa.Column("must_change_password", sa.Boolean(), server_default="0", nullable=False)
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("must_change_password")
        batch_op.drop_column("full_name")
