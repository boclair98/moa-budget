"use client";

/**
 * Browser-side API helpers. All calls hit /api/* on this same origin;
 * the nginx in front of us proxies that to the backend KSvc.
 *
 * Every fetch is wrapped in `tracked()` so the global WarmingBar can
 * react when any of them spends more than ~5s in flight (lib/warming).
 */

import { tracked } from "./warming";

export type Post = {
  id: string;
  body: string;
  author_id: string;
  author_name: string;
  created_at: string;
};

export async function fetchFeed(): Promise<Post[]> {
  return tracked(async () => {
    const r = await fetch("/api/feed", { credentials: "include" });
    if (!r.ok) return [];
    return r.json();
  });
}

export async function fetchUserPosts(userId: string): Promise<Post[]> {
  return tracked(async () => {
    const r = await fetch(`/api/users/${userId}/posts`, {
      credentials: "include",
    });
    if (!r.ok) return [];
    return r.json();
  });
}

export async function createPost(body: string): Promise<Post> {
  return tracked(async () => {
    const r = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ body }),
    });
    if (!r.ok) {
      let detail = `Post failed (${r.status})`;
      try {
        const j = await r.json();
        if (j?.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
      } catch {
        /* non-JSON */
      }
      throw new Error(detail);
    }
    return r.json();
  });
}

export type Transaction = {
  id: string;
  kind: "expense" | "income";
  amount: number;
  category: string;
  merchant: string;
  note?: string;
  account: string;
  occurred_on: string;
};

export type Budget = {
  id: string;
  month: string;
  category: string;
  limit_amount: number;
  spent: number;
};

export type Account = {
  id: string;
  name: string;
  institution: string;
  kind: "bank" | "card" | "cash" | "saving";
  balance: number;
  last4?: string;
  source: "manual" | "open_banking";
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return tracked(async () => {
    const response = await fetch(path, {
      credentials: "include",
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.detail || `요청을 처리하지 못했어요 (${response.status})`);
    }
    if (response.status === 204) return undefined as T;
    return response.json();
  });
}

export const getTransactions = (month: string) =>
  request<Transaction[]>(`/api/transactions?month=${month}`);

export const addTransaction = (data: Omit<Transaction, "id">) =>
  request<Transaction>("/api/transactions", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteTransaction = (id: string) =>
  request<void>(`/api/transactions/${id}`, { method: "DELETE" });

export const getBudgets = (month: string) =>
  request<Budget[]>(`/api/budgets?month=${month}`);

export const saveBudget = (data: Omit<Budget, "id" | "spent">) =>
  request<Budget>("/api/budgets", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getAccounts = () => request<Account[]>("/api/accounts");

export const addAccount = (data: Omit<Account, "id" | "source">) =>
  request<Account>("/api/accounts", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteAccount = (id: string) =>
  request<void>(`/api/accounts/${id}`, { method: "DELETE" });

export const importTransactions = (transactions: Omit<Transaction, "id">[]) =>
  request<{ imported: number; skipped: number }>("/api/transactions/import", {
    method: "POST",
    body: JSON.stringify({ transactions }),
  });
