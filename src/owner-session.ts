import { readStoredValue, removeStoredValue, storeValue } from "./browser-storage";

const ownerTokenKey = "asa-bolt-owner-token";

export function readOwnerToken(): string {
  return readStoredValue(ownerTokenKey);
}

export function rememberOwnerToken(token: string): boolean {
  return storeValue(ownerTokenKey, token);
}

export function forgetOwnerToken(): boolean {
  return removeStoredValue(ownerTokenKey);
}

export function restoreOwnerRoute(): void {
  if (window.location.pathname !== "/" || window.location.search || window.location.hash) return;
  if (readOwnerToken()) window.history.replaceState(null, "", "/admin");
}
