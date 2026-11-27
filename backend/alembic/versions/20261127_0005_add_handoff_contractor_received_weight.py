"""store the weight a contractor's outcome report says it received per handoff

Revision ID: 20261127_0005
Revises: 20261127_0004
Create Date: 2026-11-27 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261127_0005"
down_revision: str | None = "20261127_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Nullable: handoffs reported before this change have no stored received weight.
    with op.batch_alter_table("handoffs") as batch_op:
        batch_op.add_column(sa.Column("contractor_received_kg", sa.Numeric(12, 3), nullable=True))
        batch_op.create_check_constraint(
            "ck_handoffs_contractor_received_nonnegative",
            "contractor_received_kg IS NULL OR contractor_received_kg >= 0",
        )


def downgrade() -> None:
    with op.batch_alter_table("handoffs") as batch_op:
        batch_op.drop_constraint("ck_handoffs_contractor_received_nonnegative", type_="check")
        batch_op.drop_column("contractor_received_kg")
