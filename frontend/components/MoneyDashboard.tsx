"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  CreditCard,
  FileSpreadsheet,
  Landmark,
  LayoutDashboard,
  Link2,
  LogIn,
  Menu,
  Plus,
  Search,
  Settings,
  Target,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  addAccount,
  addTransaction,
  deleteAccount,
  deleteTransaction,
  getAccounts,
  getBudgets,
  getTransactions,
  importTransactions,
  saveBudget,
  type Account,
  type Budget,
  type Transaction,
} from "@/lib/api";
import { signInHref, signOutHref, useMe } from "@/lib/identity";

const monthKey = new Date().toISOString().slice(0, 7);
const today = new Date().toISOString().slice(0, 10);
const won = new Intl.NumberFormat("ko-KR");
const categories = ["식비", "교통", "쇼핑", "주거", "건강", "여가", "교육", "기타"];
const categoryStyle: Record<string, { icon: string; color: string }> = {
  식비: { icon: "🍚", color: "#ff795e" },
  교통: { icon: "🚌", color: "#4d9fff" },
  쇼핑: { icon: "🛍️", color: "#a778ee" },
  주거: { icon: "🏠", color: "#5fc59a" },
  건강: { icon: "💊", color: "#ff6f91" },
  여가: { icon: "🎬", color: "#f2b84b" },
  교육: { icon: "📚", color: "#5b75e7" },
  기타: { icon: "•••", color: "#7f8a96" },
  급여: { icon: "💼", color: "#33b780" },
  이자: { icon: "🏦", color: "#4d9fff" },
};

function Money({ value, sign = false }: { value: number; sign?: boolean }) {
  const prefix = sign ? (value >= 0 ? "+" : "−") : "";
  return <>{prefix}{won.format(Math.abs(value))}원</>;
}

export function MoneyDashboard() {
  const me = useMe();
  const fileInput = useRef<HTMLInputElement>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(monthKey);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<"transaction" | "budget" | "account" | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState({
    kind: "expense" as "expense" | "income",
    amount: "",
    category: "식비",
    merchant: "",
    account: "현금",
    occurred_on: today,
    note: "",
  });

  useEffect(() => {
    if (me === undefined) return;
    if (me === null) {
      setTransactions([]);
      setBudgets([]);
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([getTransactions(month), getBudgets(month), getAccounts()])
      .then(([txs, bs, savedAccounts]) => {
        setTransactions(txs);
        setBudgets(bs);
        setAccounts(savedAccounts);
        setForm((current) => ({
          ...current,
          account: savedAccounts[0]?.name || "현금",
        }));
      })
      .catch((error) => setToast(error.message))
      .finally(() => setLoading(false));
  }, [month, me]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(
    () => transactions.filter((item) =>
      `${item.merchant} ${item.category} ${item.account}`.toLowerCase().includes(query.toLowerCase())
    ),
    [transactions, query],
  );

  const totals = useMemo(() => {
    const income = transactions.filter((t) => t.kind === "income").reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = transactions.filter((t) => t.kind === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const categoryTotals = useMemo(() => {
    const totalsMap = new Map<string, number>();
    transactions.filter((t) => t.kind === "expense").forEach((t) => {
      totalsMap.set(t.category, (totalsMap.get(t.category) || 0) + Number(t.amount));
    });
    return [...totalsMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [transactions]);

  async function submitTransaction(event: FormEvent) {
    event.preventDefault();
    const payload = { ...form, amount: Number(form.amount) };
    if (!payload.amount || !payload.merchant.trim()) return;
    try {
      const created = await addTransaction(payload);
      setTransactions((items) => [created, ...items]);
      setToast("거래를 저장했어요");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "저장하지 못했어요");
      return;
    }
    setModal(null);
    setForm((value) => ({ ...value, amount: "", merchant: "", note: "" }));
  }

  async function remove(id: string) {
    await deleteTransaction(id)
      .then(() => setTransactions((items) => items.filter((item) => item.id !== id)))
      .catch(() => setToast("삭제하지 못했어요"));
  }

  async function submitBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      month,
      category: String(data.get("category")),
      limit_amount: Number(data.get("limit_amount")),
    };
    const existing = budgets.find((b) => b.category === payload.category);
    try {
      const saved = await saveBudget(payload);
      setBudgets((items) => [...items.filter((b) => b.category !== saved.category), { ...saved, spent: existing?.spent || 0 }]);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "예산을 저장하지 못했어요");
      return;
    }
    setModal(null);
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const account = await addAccount({
        name: String(data.get("name")).trim(),
        institution: String(data.get("institution")).trim(),
        kind: String(data.get("kind")) as Account["kind"],
        balance: Number(String(data.get("balance")).replace(/,/g, "")),
        last4: String(data.get("last4")).trim() || undefined,
      });
      setAccounts((items) => [...items, account]);
      if (accounts.length === 0) setForm((current) => ({ ...current, account: account.name }));
      setModal(null);
      setToast("계좌를 등록했어요");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "계좌를 등록하지 못했어요");
    }
  }

  async function removeAccount(id: string) {
    await deleteAccount(id)
      .then(() => setAccounts((items) => items.filter((item) => item.id !== id)))
      .catch(() => setToast("계좌를 삭제하지 못했어요"));
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text();
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      setToast("가져올 거래가 없어요");
      return;
    }
    const parseLine = (line: string) => {
      const cells: string[] = [];
      let value = "";
      let quoted = false;
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') quoted = !quoted;
        else if (char === "," && !quoted) { cells.push(value.trim()); value = ""; }
        else value += char;
      }
      cells.push(value.trim());
      return cells;
    };
    const headers = parseLine(lines[0]).map((header) => header.replace(/"/g, "").toLowerCase());
    const find = (...names: string[]) => headers.findIndex((header) => names.includes(header));
    const dateIndex = find("날짜", "거래일", "date");
    const merchantIndex = find("내용", "적요", "거래내용", "merchant");
    const amountIndex = find("금액", "거래금액", "amount");
    const typeIndex = find("구분", "입출금", "type");
    const categoryIndex = find("카테고리", "category");
    const accountIndex = find("계좌", "account");
    if (dateIndex < 0 || merchantIndex < 0 || amountIndex < 0) {
      setToast("CSV에 날짜, 내용, 금액 열이 필요해요");
      return;
    }
    const parsed = lines.slice(1).map(parseLine).map((row) => {
      const signedAmount = Number((row[amountIndex] || "0").replace(/[^\d-]/g, ""));
      const type = (row[typeIndex] || "").toLowerCase();
      const kind = (type.includes("수입") || type.includes("입금") || type === "income" || signedAmount > 0) ? "income" : "expense";
      return {
        kind: kind as "income" | "expense",
        amount: Math.abs(signedAmount),
        category: row[categoryIndex] || (kind === "income" ? "기타" : "미분류"),
        merchant: row[merchantIndex]?.replace(/^"|"$/g, "") || "거래",
        account: row[accountIndex] || accounts[0]?.name || "가져온 거래",
        occurred_on: (row[dateIndex] || today).replace(/[./]/g, "-").slice(0, 10),
        note: `${file.name}에서 가져옴`,
      };
    }).filter((row) => row.amount > 0);
    if (!parsed.length) {
      setToast("금액이 있는 거래를 찾지 못했어요");
      return;
    }
    try {
      const result = await importTransactions(parsed);
      const refreshed = await getTransactions(month);
      setTransactions(refreshed);
      setToast(`${result.imported}건을 가져왔어요${result.skipped ? ` · 중복 ${result.skipped}건 제외` : ""}`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "가져오지 못했어요");
    }
  }

  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
  const highest = categoryTotals[0];
  const remainingDays = Math.max(1, new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate() - new Date().getDate());
  const netAssets = accounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const isEmpty = !loading && transactions.length === 0 && accounts.length === 0;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand"><span className="brand-mark">ㅁ</span><span>모아</span><button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="메뉴 닫기"><X size={19} /></button></div>
        <nav className="nav-list" aria-label="주 메뉴">
          <a className="nav-item active" href="#overview"><LayoutDashboard size={19} />한눈에 보기</a>
          <a className="nav-item" href="#transactions"><WalletCards size={19} />거래 내역</a>
          <a className="nav-item" href="#budgets"><Target size={19} />예산</a>
          <a className="nav-item" href="#report"><TrendingUp size={19} />리포트</a>
          <a className="nav-item" href="#accounts"><Landmark size={19} />자산</a>
        </nav>
        <div className="nav-label">내 계좌</div>
        {accounts.map((account, index) => (
          <div className="account-link" key={account.id}>
            <span className={`account-dot ${index % 2 ? "blue" : "coral"}`} />
            {account.name}
            <strong>{won.format(Number(account.balance))}원</strong>
          </div>
        ))}
        {me && accounts.length === 0 && <button className="sidebar-add" onClick={() => setModal("account")}><Plus size={14} />계좌 등록</button>}
        <div className="sidebar-bottom">
          <a className="nav-item" href="#help"><CircleHelp size={18} />도움말</a>
          <a className="nav-item" href="#settings"><Settings size={18} />설정</a>
          {me ? (
            <a className="profile-chip" href={signOutHref()}>
              <span>{me.display_name.slice(0, 1)}</span>
              <div><b>{me.display_name}</b><small>로그아웃</small></div>
            </a>
          ) : (
            <a className="profile-chip" href={signInHref()}>
              <span><LogIn size={16} /></span>
              <div><b>Google로 로그인</b><small>내 데이터 저장하기</small></div>
            </a>
          )}
        </div>
      </aside>

      {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="메뉴 닫기" />}

      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="메뉴 열기"><Menu /></button>
          <div className="month-control"><CalendarDays size={18} /><input aria-label="조회 월" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /><ChevronDown size={15} /></div>
          <div className="top-actions">
            <label className="search-box"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="거래 검색" aria-label="거래 검색" /></label>
            <button className="icon-button" aria-label="알림"><Bell size={19} /><span className="notify-dot" /></button>
            <button className="primary-button" onClick={() => me ? setModal("transaction") : window.location.assign(signInHref())}><Plus size={18} />거래 추가</button>
          </div>
        </header>

        <div className="content" id="overview">
          <section className="welcome-row">
            <div><p className="eyebrow">{monthLabel}</p><h1>이번 달 돈의 흐름</h1><p>오늘도 내 돈을 가볍게 들여다봐요.</p></div>
            <div className="privacy-pill">실제 데이터만 표시 · 사용자별 분리 저장</div>
          </section>

          {me === null && (
            <section className="onboarding-card">
              <div className="onboarding-icon"><Landmark size={25} /></div>
              <div><p className="eyebrow">내 가계부 시작하기</p><h2>로그인하면 나만의 안전한 공간이 생겨요</h2><p>예시 금액은 더 이상 표시하지 않습니다. 로그인 후 계좌를 등록하거나 은행 거래 CSV를 가져오세요.</p></div>
              <a className="primary-button" href={signInHref()}><LogIn size={17} />Google로 시작하기</a>
            </section>
          )}

          {me && isEmpty && (
            <section className="onboarding-card">
              <div className="onboarding-icon"><WalletCards size={25} /></div>
              <div><p className="eyebrow">0원부터 정확하게</p><h2>첫 계좌나 거래를 등록하세요</h2><p>직접 계좌를 추가하거나 은행·카드사에서 내려받은 CSV로 거래를 한 번에 가져올 수 있어요.</p></div>
              <div className="onboarding-actions">
                <button className="primary-button" onClick={() => setModal("account")}><Plus size={17} />계좌 등록</button>
                <button className="secondary-button" onClick={() => fileInput.current?.click()}><FileSpreadsheet size={17} />CSV 가져오기</button>
              </div>
            </section>
          )}

          <section className="summary-grid">
            <article className="summary-card balance-card">
              <div className="card-label"><span className="label-icon mint"><WalletCards size={17} /></span>이번 달 순현금흐름</div>
              <strong><Money value={totals.balance} /></strong>
              <div className="sub-row"><span>실제 기록된 거래</span><b>{transactions.length}건</b></div>
            </article>
            <article className="summary-card">
              <div className="card-label"><span className="label-icon blue-bg"><ArrowDownLeft size={17} /></span>들어온 돈</div>
              <strong><Money value={totals.income} /></strong>
              <div className="sub-row"><span>수입 거래</span><b>{transactions.filter((item) => item.kind === "income").length}건</b></div>
            </article>
            <article className="summary-card">
              <div className="card-label"><span className="label-icon coral-bg"><ArrowUpRight size={17} /></span>나간 돈</div>
              <strong><Money value={totals.expense} /></strong>
              <div className="sub-row"><span>하루 평균</span><b>{won.format(Math.round(totals.expense / Math.max(1, new Date().getDate())))}원</b></div>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="panel spending-panel" id="report">
              <div className="panel-head"><div><h2>어디에 가장 많이 썼을까요?</h2><p>카테고리별 지출을 비교해보세요.</p></div><button className="text-button">자세히 보기</button></div>
              {categoryTotals.length ? <div className="chart-wrap">
                <div className="donut" style={{ background: categoryTotals.length ? `conic-gradient(${categoryTotals.map(([cat, amount], i) => `${categoryStyle[cat]?.color || "#8c96a3"} ${i ? categoryTotals.slice(0, i).reduce((s, x) => s + x[1], 0) / Math.max(totals.expense, 1) * 100 : 0}% ${(categoryTotals.slice(0, i + 1).reduce((s, x) => s + x[1], 0) / Math.max(totals.expense, 1)) * 100}%`).join(",")})` : "#edf0f2" }}>
                  <div className="donut-hole"><small>총 지출</small><b>{won.format(totals.expense)}</b><span>원</span></div>
                </div>
                <div className="legend">
                  {categoryTotals.map(([category, amount]) => (
                    <div className="legend-row" key={category}><span className="legend-color" style={{ background: categoryStyle[category]?.color }} /><b>{category}</b><span>{won.format(amount)}원</span><em>{Math.round(amount / Math.max(totals.expense, 1) * 100)}%</em></div>
                  ))}
                </div>
              </div> : <div className="panel-empty"><TrendingUp size={25} /><b>아직 분석할 지출이 없어요</b><span>거래를 추가하면 실제 지출 비중을 계산해드려요.</span></div>}
            </article>

            <article className="panel insight-panel">
              <div className="sparkle">✦</div>
              <p className="eyebrow">모아의 발견</p>
              <h2>{highest ? `${highest[0]} 지출이 가장 커요` : "첫 거래를 기록해보세요"}</h2>
              <p>{highest ? `이번 달 ${highest[0]}에 ${won.format(highest[1])}원을 썼어요. 지난달보다 조금만 줄여도 목표 저축에 가까워질 수 있어요.` : "작은 기록이 모이면 돈의 흐름이 선명해져요."}</p>
              <div className="insight-stat"><span>남은 기간 하루 평균 여유</span><strong>{won.format(Math.max(0, Math.round(totals.balance / remainingDays)))}원</strong><small>실제 순현금흐름 · 남은 {remainingDays}일 기준</small></div>
            </article>
          </section>

          <section className="dashboard-grid lower">
            <article className="panel" id="budgets">
              <div className="panel-head"><div><h2>이번 달 예산</h2><p>계획한 만큼 잘 쓰고 있어요.</p></div><button className="round-plus" onClick={() => me ? setModal("budget") : window.location.assign(signInHref())} aria-label="예산 추가"><Plus size={17} /></button></div>
              {budgets.length ? <div className="budget-list">
                {budgets.map((budget) => {
                  const percentage = Math.round(Number(budget.spent) / Number(budget.limit_amount) * 100);
                  return <div className="budget-row" key={budget.id}>
                    <span className="category-emoji">{categoryStyle[budget.category]?.icon || "•••"}</span>
                    <div className="budget-data"><div><b>{budget.category}</b><span><strong>{won.format(Number(budget.spent))}원</strong> / {won.format(Number(budget.limit_amount))}원</span></div><div className="progress"><i style={{ width: `${Math.min(100, percentage)}%`, background: percentage > 90 ? "#ff795e" : categoryStyle[budget.category]?.color }} /></div></div>
                    <em className={percentage > 90 ? "danger" : ""}>{percentage}%</em>
                  </div>;
                })}
              </div> : <button className="inline-empty" onClick={() => me ? setModal("budget") : window.location.assign(signInHref())}><Target size={21} /><span><b>예산이 아직 없어요</b><small>카테고리별 한도를 정해보세요.</small></span><Plus size={17} /></button>}
            </article>

            <article className="panel mini-assets" id="accounts">
              <div className="panel-head"><div><h2>내 자산</h2><p>내가 등록한 계좌와 카드</p></div><button className="text-button" onClick={() => me ? setModal("account") : window.location.assign(signInHref())}>계좌 추가</button></div>
              <div className="asset-total"><small>등록된 순자산</small><strong>{won.format(netAssets)}원</strong><span>{accounts.length}개 계좌 기준</span></div>
              {accounts.length ? <div className="account-cards">{accounts.map((account) => <div key={account.id}><span><b>{account.name}</b><small>{account.institution}{account.last4 ? ` · ${account.last4}` : ""}</small></span><strong>{won.format(Number(account.balance))}원</strong><button onClick={() => removeAccount(account.id)} aria-label={`${account.name} 삭제`}><Trash2 size={14} /></button></div>)}</div> : <div className="panel-empty small"><Landmark size={22} /><b>등록된 계좌가 없어요</b></div>}
            </article>
          </section>

          <section className="panel transaction-panel" id="transactions">
            <div className="panel-head"><div><h2>최근 거래</h2><p>직접 기록하거나 CSV로 가져온 실제 내역입니다.</p></div><div className="head-actions"><button className="text-button" onClick={() => me ? fileInput.current?.click() : window.location.assign(signInHref())}><FileSpreadsheet size={14} />CSV 가져오기</button><button className="text-button" onClick={() => me ? setModal("transaction") : window.location.assign(signInHref())}><Plus size={14} />직접 추가</button></div></div>
            <input ref={fileInput} hidden type="file" accept=".csv,text/csv" onChange={importCsv} />
            <div className="transaction-list">
              {filtered.map((item) => (
                <div className="transaction-row" key={item.id}>
                  <span className="category-emoji">{categoryStyle[item.category]?.icon || "•••"}</span>
                  <div className="transaction-name"><b>{item.merchant}</b><span>{item.category} · {item.account}</span></div>
                  <time>{new Date(`${item.occurred_on}T00:00:00`).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</time>
                  <strong className={item.kind === "income" ? "positive" : ""}><Money value={item.kind === "income" ? Number(item.amount) : -Number(item.amount)} sign /></strong>
                  <button className="delete-button" onClick={() => remove(item.id)} aria-label={`${item.merchant} 삭제`}><Trash2 size={16} /></button>
                </div>
              ))}
              {!filtered.length && <div className="empty-state"><CreditCard size={28} /><b>{query ? "조건에 맞는 거래가 없어요" : "아직 거래가 없어요"}</b><span>{query ? "검색어를 바꿔보세요." : "직접 추가하거나 CSV로 가져오세요."}</span></div>}
            </div>
          </section>
        </div>
      </main>

      {modal === "transaction" && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="transaction-title" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head"><div><p className="eyebrow">새 기록</p><h2 id="transaction-title">거래 추가</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="닫기"><X size={19} /></button></div>
            <form onSubmit={submitTransaction}>
              <div className="segmented"><button type="button" className={form.kind === "expense" ? "active" : ""} onClick={() => setForm({ ...form, kind: "expense", category: "식비" })}>지출</button><button type="button" className={form.kind === "income" ? "active income" : ""} onClick={() => setForm({ ...form, kind: "income", category: "급여" })}>수입</button></div>
              <label className="amount-field"><span>금액</span><div><input autoFocus inputMode="numeric" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/\D/g, "") })} placeholder="0" /><b>원</b></div></label>
              <div className="form-grid">
                <label><span>내용</span><input required maxLength={80} value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} placeholder="어디에서 썼나요?" /></label>
                <label><span>날짜</span><input type="date" required value={form.occurred_on} onChange={(e) => setForm({ ...form, occurred_on: e.target.value })} /></label>
                <label><span>카테고리</span><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{(form.kind === "income" ? ["급여", "이자", "기타"] : categories).map((c) => <option key={c}>{c}</option>)}</select></label>
                <label><span>결제 수단</span><select value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })}>{accounts.map((account) => <option key={account.id}>{account.name}</option>)}<option>현금</option></select></label>
              </div>
              <label><span>메모 <small>선택</small></span><input maxLength={240} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="기억해둘 내용을 적어보세요" /></label>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>취소</button><button className="primary-button">저장하기</button></div>
            </form>
          </section>
        </div>
      )}

      {modal === "budget" && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}>
          <section className="modal compact" role="dialog" aria-modal="true" aria-labelledby="budget-title" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head"><div><p className="eyebrow">{monthLabel}</p><h2 id="budget-title">예산 설정</h2></div><button className="icon-button" onClick={() => setModal(null)}><X size={19} /></button></div>
            <form onSubmit={submitBudget}>
              <label><span>카테고리</span><select name="category">{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label><span>한 달 예산</span><input name="limit_amount" inputMode="numeric" required placeholder="예: 500000" /></label>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>취소</button><button className="primary-button">예산 저장</button></div>
            </form>
          </section>
        </div>
      )}

      {modal === "account" && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}>
          <section className="modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head"><div><p className="eyebrow">실제 자산 등록</p><h2 id="account-title">계좌 추가</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="닫기"><X size={19} /></button></div>
            <div className="bank-connect">
              <span><Link2 size={19} /></span>
              <div><b>은행 자동연결</b><small>금융결제원 이용기관 승인 후 활성화됩니다.</small></div>
              <button disabled>준비 중</button>
            </div>
            <p className="security-note">계좌 비밀번호·인증번호는 받지 않습니다. 지금은 계좌 이름과 현재 잔액만 직접 등록할 수 있어요.</p>
            <form onSubmit={submitAccount}>
              <div className="form-grid">
                <label><span>계좌 이름</span><input name="name" required maxLength={40} placeholder="예: 월급 통장" /></label>
                <label><span>금융기관</span><input name="institution" required maxLength={40} placeholder="예: 국민은행" /></label>
                <label><span>종류</span><select name="kind"><option value="bank">입출금 계좌</option><option value="saving">예·적금</option><option value="card">신용카드</option><option value="cash">현금</option></select></label>
                <label><span>계좌번호 끝 4자리 <small>선택</small></span><input name="last4" inputMode="numeric" pattern="\d{4}" maxLength={4} placeholder="1234" /></label>
              </div>
              <label><span>현재 잔액</span><input name="balance" inputMode="numeric" required defaultValue="0" placeholder="0" /></label>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>취소</button><button className="primary-button">계좌 저장</button></div>
            </form>
          </section>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
