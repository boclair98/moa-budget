"""financial accounts and import deduplication

Revision ID: 0003
Revises: 0002
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("import_key", sa.String(64)))
    op.create_unique_constraint(
        "uq_transactions_owner_import_key",
        "transactions",
        ["owner_id", "import_key"],
    )
    op.create_table(
        "financial_accounts",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "owner_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(40), nullable=False),
        sa.Column("institution", sa.String(40), nullable=False),
        sa.Column("kind", sa.String(12), nullable=False),
        sa.Column("balance", sa.Numeric(14, 0), nullable=False, server_default="0"),
        sa.Column("last4", sa.String(4)),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "kind IN ('bank', 'card', 'cash', 'saving')",
            name="ck_financial_accounts_kind",
        ),
    )
    op.create_index("ix_financial_accounts_owner_id", "financial_accounts", ["owner_id"])


def downgrade() -> None:
    op.drop_table("financial_accounts")
    op.drop_constraint(
        "uq_transactions_owner_import_key",
        "transactions",
        type_="unique",
    )
    op.drop_column("transactions", "import_key")
