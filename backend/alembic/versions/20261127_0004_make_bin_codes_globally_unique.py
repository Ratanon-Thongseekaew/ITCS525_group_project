"""make bin codes unique across all sites

Revision ID: 20261127_0004
Revises: 20261126_0003
Create Date: 2026-11-27 09:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261127_0004"
down_revision: str | None = "20261126_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

bins = sa.table(
    "bins",
    sa.column("id", sa.Integer),
    sa.column("site_id", sa.Integer),
    sa.column("code", sa.String),
)
sites = sa.table("sites", sa.column("id", sa.Integer), sa.column("code", sa.String))


def upgrade() -> None:
    # Codes used to be unique per site only. Prefix any code shared by several sites with its
    # site code, so the new constraint can be created on existing data.
    connection = op.get_bind()
    shared_codes = (
        sa.select(bins.c.code)
        .group_by(bins.c.code)
        .having(sa.func.count(sa.distinct(bins.c.site_id)) > 1)
    )
    clashing_rows = connection.execute(
        sa.select(bins.c.id, bins.c.code, sites.c.code.label("site_code"))
        .join(sites, sites.c.id == bins.c.site_id)
        .where(bins.c.code.in_(shared_codes))
    ).all()
    for row in clashing_rows:
        connection.execute(
            bins.update().where(bins.c.id == row.id).values(code=f"{row.site_code}-{row.code}")
        )

    with op.batch_alter_table("bins") as batch_op:
        batch_op.drop_constraint("uq_bins_site_code", type_="unique")
        batch_op.create_unique_constraint("uq_bins_code", ["code"])


def downgrade() -> None:
    # Renamed codes are kept; they are still unique per site.
    with op.batch_alter_table("bins") as batch_op:
        batch_op.drop_constraint("uq_bins_code", type_="unique")
        batch_op.create_unique_constraint("uq_bins_site_code", ["site_id", "code"])
