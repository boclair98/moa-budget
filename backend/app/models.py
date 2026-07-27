import uuid
from datetime import datetime
from datetime import date
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    """App-local user, keyed on the platform's coders_id.

    coders.kr already knows who this visitor is (they signed in via
    `mcp.coders.kr/sso/login`); we keep a row in our own DB the first
    time we see them so app-local data (Posts, preferences, …) can FK
    against a stable local UUID without joining out to the platform.

    When the platform someday hands us extra profile fields, sync
    `display_name` / `avatar_url` here on each request.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # The X-Coders-User value the gate sent. Unique per visitor.
    coders_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), unique=True, nullable=False, index=True
    )
    # Editable inside the app. Default to a short slice of coders_id so
    # something shows up before the user picks a name.
    display_name: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    first_seen_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )

    posts: Mapped[list["Post"]] = relationship(
        back_populates="author", cascade="all, delete-orphan"
    )
    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    budgets: Mapped[list["Budget"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    accounts: Mapped[list["FinancialAccount"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )


class Post(Base):
    """A short message authored by a logged-in user."""

    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    body: Mapped[str] = mapped_column(sa.String(280), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), index=True
    )

    author: Mapped[User] = relationship(back_populates="posts")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(sa.String(12), nullable=False)
    amount: Mapped[Decimal] = mapped_column(sa.Numeric(14, 0), nullable=False)
    category: Mapped[str] = mapped_column(sa.String(32), nullable=False, index=True)
    merchant: Mapped[str] = mapped_column(sa.String(80), nullable=False)
    note: Mapped[str | None] = mapped_column(sa.String(240))
    account: Mapped[str] = mapped_column(sa.String(32), nullable=False, default="생활비 통장")
    import_key: Mapped[str | None] = mapped_column(sa.String(64))
    occurred_on: Mapped[date] = mapped_column(sa.Date, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )

    owner: Mapped[User] = relationship(back_populates="transactions")


class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (sa.UniqueConstraint("owner_id", "month", "category"),)

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    month: Mapped[str] = mapped_column(sa.String(7), nullable=False, index=True)
    category: Mapped[str] = mapped_column(sa.String(32), nullable=False)
    limit_amount: Mapped[Decimal] = mapped_column(sa.Numeric(14, 0), nullable=False)

    owner: Mapped[User] = relationship(back_populates="budgets")


class FinancialAccount(Base):
    __tablename__ = "financial_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(sa.String(40), nullable=False)
    institution: Mapped[str] = mapped_column(sa.String(40), nullable=False)
    kind: Mapped[str] = mapped_column(sa.String(12), nullable=False)
    balance: Mapped[Decimal] = mapped_column(sa.Numeric(14, 0), nullable=False, default=0)
    last4: Mapped[str | None] = mapped_column(sa.String(4))
    source: Mapped[str] = mapped_column(sa.String(20), nullable=False, default="manual")
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()
    )

    owner: Mapped[User] = relationship(back_populates="accounts")
