from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from hashlib import sha256

from sqlalchemy import case, delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.identity import require_identity
from app.models import Budget, FinancialAccount, Transaction
from app.routes.users import upsert_local_user

router = APIRouter(prefix="/api", tags=["finance"])


class TransactionIn(BaseModel):
    kind: str
    amount: Decimal = Field(gt=0, le=999_999_999_999)
    category: str = Field(min_length=1, max_length=32)
    merchant: str = Field(min_length=1, max_length=80)
    note: str | None = Field(default=None, max_length=240)
    account: str = Field(default="생활비 통장", min_length=1, max_length=32)
    occurred_on: date

    @field_validator("kind")
    @classmethod
    def valid_kind(cls, value: str) -> str:
        if value not in {"expense", "income"}:
            raise ValueError("kind must be expense or income")
        return value


class TransactionOut(TransactionIn):
    id: str


def transaction_out(row: Transaction) -> TransactionOut:
    return TransactionOut(
        id=str(row.id),
        kind=row.kind,
        amount=row.amount,
        category=row.category,
        merchant=row.merchant,
        note=row.note,
        account=row.account,
        occurred_on=row.occurred_on,
    )


class BulkTransactionsIn(BaseModel):
    transactions: list[TransactionIn] = Field(min_length=1, max_length=500)


class BulkTransactionsOut(BaseModel):
    imported: int
    skipped: int


@router.post("/transactions/import", response_model=BulkTransactionsOut)
async def import_transactions(
    payload: BulkTransactionsIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> BulkTransactionsOut:
    user = await upsert_local_user(session, coders_id)
    incoming: list[tuple[str, TransactionIn]] = []
    for item in payload.transactions:
        raw = "|".join(
            [
                str(item.occurred_on),
                item.kind,
                str(item.amount),
                item.merchant.strip(),
                item.account.strip(),
            ]
        )
        incoming.append((sha256(raw.encode("utf-8")).hexdigest(), item))
    keys = [key for key, _ in incoming]
    existing = set(
        (
            await session.execute(
                select(Transaction.import_key).where(
                    Transaction.owner_id == user.id,
                    Transaction.import_key.in_(keys),
                )
            )
        ).scalars()
    )
    created = 0
    for key, item in incoming:
        if key in existing:
            continue
        session.add(Transaction(owner_id=user.id, import_key=key, **item.model_dump()))
        existing.add(key)
        created += 1
    await session.flush()
    return BulkTransactionsOut(imported=created, skipped=len(incoming) - created)


@router.get("/transactions", response_model=list[TransactionOut])
async def list_transactions(
    month: str = Query(pattern=r"^\d{4}-\d{2}$"),
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> list[TransactionOut]:
    user = await upsert_local_user(session, coders_id)
    rows = await session.execute(
        select(Transaction)
        .where(
            Transaction.owner_id == user.id,
            func.to_char(Transaction.occurred_on, "YYYY-MM") == month,
        )
        .order_by(Transaction.occurred_on.desc(), Transaction.created_at.desc())
        .limit(500)
    )
    return [transaction_out(row) for row in rows.scalars()]


@router.post("/transactions", response_model=TransactionOut, status_code=201)
async def create_transaction(
    payload: TransactionIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> TransactionOut:
    user = await upsert_local_user(session, coders_id)
    row = Transaction(owner_id=user.id, **payload.model_dump())
    session.add(row)
    await session.flush()
    return transaction_out(row)


@router.delete("/transactions/{transaction_id}", status_code=204)
async def remove_transaction(
    transaction_id: UUID,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> None:
    user = await upsert_local_user(session, coders_id)
    result = await session.execute(
        delete(Transaction).where(
            Transaction.id == transaction_id, Transaction.owner_id == user.id
        )
    )
    if result.rowcount == 0:
        raise HTTPException(404, "transaction not found")


class BudgetIn(BaseModel):
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    category: str = Field(min_length=1, max_length=32)
    limit_amount: Decimal = Field(gt=0, le=999_999_999_999)


class BudgetOut(BudgetIn):
    id: str
    spent: Decimal


@router.get("/budgets", response_model=list[BudgetOut])
async def list_budgets(
    month: str = Query(pattern=r"^\d{4}-\d{2}$"),
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> list[BudgetOut]:
    user = await upsert_local_user(session, coders_id)
    spent = (
        select(
            Transaction.category.label("category"),
            func.coalesce(func.sum(Transaction.amount), 0).label("spent"),
        )
        .where(
            Transaction.owner_id == user.id,
            Transaction.kind == "expense",
            func.to_char(Transaction.occurred_on, "YYYY-MM") == month,
        )
        .group_by(Transaction.category)
        .subquery()
    )
    rows = await session.execute(
        select(Budget, func.coalesce(spent.c.spent, 0))
        .outerjoin(spent, spent.c.category == Budget.category)
        .where(Budget.owner_id == user.id, Budget.month == month)
        .order_by(Budget.category)
    )
    return [
        BudgetOut(
            id=str(budget.id),
            month=budget.month,
            category=budget.category,
            limit_amount=budget.limit_amount,
            spent=used,
        )
        for budget, used in rows
    ]


@router.post("/budgets", response_model=BudgetOut)
async def upsert_budget(
    payload: BudgetIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> BudgetOut:
    user = await upsert_local_user(session, coders_id)
    statement = (
        insert(Budget)
        .values(owner_id=user.id, **payload.model_dump())
        .on_conflict_do_update(
            index_elements=["owner_id", "month", "category"],
            set_={"limit_amount": payload.limit_amount},
        )
        .returning(Budget)
    )
    budget = (await session.execute(statement)).scalar_one()
    return BudgetOut(
        id=str(budget.id),
        month=budget.month,
        category=budget.category,
        limit_amount=budget.limit_amount,
        spent=0,
    )


class SummaryOut(BaseModel):
    income: Decimal
    expense: Decimal
    balance: Decimal
    category_totals: dict[str, Decimal]


@router.get("/summary", response_model=SummaryOut)
async def summary(
    month: str = Query(pattern=r"^\d{4}-\d{2}$"),
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> SummaryOut:
    user = await upsert_local_user(session, coders_id)
    base = (
        Transaction.owner_id == user.id,
        func.to_char(Transaction.occurred_on, "YYYY-MM") == month,
    )
    totals = await session.execute(
        select(
            func.coalesce(
                func.sum(case((Transaction.kind == "income", Transaction.amount), else_=0)),
                0,
            ),
            func.coalesce(
                func.sum(case((Transaction.kind == "expense", Transaction.amount), else_=0)),
                0,
            ),
        ).where(*base)
    )
    income, expense = totals.one()
    category_rows = await session.execute(
        select(Transaction.category, func.sum(Transaction.amount))
        .where(*base, Transaction.kind == "expense")
        .group_by(Transaction.category)
    )
    return SummaryOut(
        income=income,
        expense=expense,
        balance=income - expense,
        category_totals={category: amount for category, amount in category_rows},
    )


class AccountIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    institution: str = Field(min_length=1, max_length=40)
    kind: str
    balance: Decimal = Field(default=0, ge=-999_999_999_999, le=999_999_999_999)
    last4: str | None = Field(default=None, pattern=r"^\d{4}$")

    @field_validator("kind")
    @classmethod
    def valid_account_kind(cls, value: str) -> str:
        if value not in {"bank", "card", "cash", "saving"}:
            raise ValueError("unsupported account kind")
        return value


class AccountOut(AccountIn):
    id: str
    source: str


def account_out(account: FinancialAccount) -> AccountOut:
    return AccountOut(
        id=str(account.id),
        name=account.name,
        institution=account.institution,
        kind=account.kind,
        balance=account.balance,
        last4=account.last4,
        source=account.source,
    )


@router.get("/accounts", response_model=list[AccountOut])
async def list_accounts(
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> list[AccountOut]:
    user = await upsert_local_user(session, coders_id)
    rows = await session.execute(
        select(FinancialAccount)
        .where(FinancialAccount.owner_id == user.id)
        .order_by(FinancialAccount.created_at)
    )
    return [account_out(row) for row in rows.scalars()]


@router.post("/accounts", response_model=AccountOut, status_code=201)
async def create_account(
    payload: AccountIn,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> AccountOut:
    user = await upsert_local_user(session, coders_id)
    row = FinancialAccount(owner_id=user.id, source="manual", **payload.model_dump())
    session.add(row)
    await session.flush()
    return account_out(row)


@router.delete("/accounts/{account_id}", status_code=204)
async def remove_account(
    account_id: UUID,
    coders_id: UUID = Depends(require_identity),
    session: AsyncSession = Depends(get_session),
) -> None:
    user = await upsert_local_user(session, coders_id)
    result = await session.execute(
        delete(FinancialAccount).where(
            FinancialAccount.id == account_id, FinancialAccount.owner_id == user.id
        )
    )
    if result.rowcount == 0:
        raise HTTPException(404, "account not found")


@router.get("/integrations/open-banking/status")
async def open_banking_status() -> dict[str, bool | str]:
    return {
        "available": False,
        "provider": "KFTC Open Banking",
        "reason": "이용기관 계약 및 운영 인증정보가 필요합니다.",
    }
