"""add persisted resale bin processing records

Revision ID: 20261126_0003
Revises: 20261124_0002
Create Date: 2026-11-26 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel

from alembic import op

revision: str = "20261126_0003"
down_revision: str | None = "20261124_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "resale_bin_processes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("bin_id", sa.Integer(), nullable=False),
        sa.Column("processed_by_user_id", sa.Integer(), nullable=False),
        sa.Column("accepted_item_count", sa.Integer(), nullable=False),
        sa.Column("rejected_item_count", sa.Integer(), nullable=False),
        sa.Column("revenue", sa.Numeric(12, 2), nullable=False),
        sa.Column("processed_at", sa.Date(), nullable=False),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "accepted_item_count >= 0", name="ck_resale_bin_processes_accepted_nonnegative"
        ),
        sa.CheckConstraint(
            "rejected_item_count >= 0", name="ck_resale_bin_processes_rejected_nonnegative"
        ),
        sa.CheckConstraint("revenue >= 0", name="ck_resale_bin_processes_revenue_nonnegative"),
        sa.ForeignKeyConstraint(["bin_id"], ["bins.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["processed_by_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("bin_id", name="uq_resale_bin_processes_bin"),
    )
    op.create_index(
        op.f("ix_resale_bin_processes_bin_id"), "resale_bin_processes", ["bin_id"], unique=False
    )
    op.create_index(
        op.f("ix_resale_bin_processes_processed_by_user_id"),
        "resale_bin_processes",
        ["processed_by_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_resale_bin_processes_processed_by_user_id"), table_name="resale_bin_processes"
    )
    op.drop_index(op.f("ix_resale_bin_processes_bin_id"), table_name="resale_bin_processes")
    op.drop_table("resale_bin_processes")
