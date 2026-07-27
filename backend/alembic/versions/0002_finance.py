"""transactions and budgets

Revision ID: 0002
Revises: 0001
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "transactions",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(12), nullable=False),
        sa.Column("amount", sa.Numeric(14, 0), nullable=False),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column("merchant", sa.String(80), nullable=False),
        sa.Column("note", sa.String(240)),
        sa.Column("account", sa.String(32), nullable=False),
        sa.Column("occurred_on", sa.Date, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("kind IN ('expense', 'income')", name="ck_transactions_kind"),
        sa.CheckConstraint("amount > 0", name="ck_transactions_amount"),
    )
    op.create_index("ix_transactions_owner_id", "transactions", ["owner_id"])
    op.create_index("ix_transactions_occurred_on", "transactions", ["occurred_on"])
    op.create_index("ix_transactions_category", "transactions", ["category"])
    op.create_index("ix_transactions_owner_date", "transactions", ["owner_id", "occurred_on"])

    op.create_table(
        "budgets",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column("limit_amount", sa.Numeric(14, 0), nullable=False),
        sa.UniqueConstraint("owner_id", "month", "category"),
        sa.CheckConstraint("limit_amount > 0", name="ck_budgets_limit"),
    )
    op.create_index("ix_budgets_owner_id", "budgets", ["owner_id"])
    op.create_index("ix_budgets_month", "budgets", ["month"])


def downgrade() -> None:
    op.drop_table("budgets")
    op.drop_table("transactions")
