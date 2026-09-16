/**
 * Request-scoped authenticated user for supplier search (Module 03).
 * Set only after JWT verification via /auth/me — never from client JSON.
 */
import { AsyncLocalStorage } from "node:async_hooks";

type SearchUserStore = { userId: string };

const searchUserContext = new AsyncLocalStorage<SearchUserStore>();

export function getSearchUserId(): string | undefined {
  return searchUserContext.getStore()?.userId;
}

export function withSearchUser<T>(userId: string | null | undefined, fn: () => T): T {
  if (!userId) return fn();
  return searchUserContext.run({ userId }, fn);
}
