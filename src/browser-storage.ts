export function readStoredValue(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    console.warn("Browser storage is unavailable; saved preferences cannot be restored.");
    return "";
  }
}

export function storeValue(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    console.warn("Browser storage is unavailable; this preference could not be remembered.");
    return false;
  }
}

export function removeStoredValue(key: string): boolean {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    console.warn("Browser storage is unavailable; this preference could not be removed.");
    return false;
  }
}
