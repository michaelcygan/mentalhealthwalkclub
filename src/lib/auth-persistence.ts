// Long-lived auth persistence backup.
//
// Supabase's auth client persists the session in localStorage. On iOS
// home-screen web apps, localStorage is evicted after ~7 days of non-use,
// which silently signs the user out. To survive that, we mirror the auth
// token into IndexedDB (which iOS keeps for much longer) and restore it
// back into localStorage on launch if it's missing.

const DB_NAME = "wc-auth";
const STORE = "kv";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(key: string, value: string | null): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      if (value === null) store.delete(key);
      else store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* best-effort */
  }
}

function authStorageKey(): string | null {
  if (typeof window === "undefined") return null;
  // Supabase stores the session under `sb-<projectRef>-auth-token`.
  // Discover the key dynamically so we don't need to hardcode the ref.
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) return k;
  }
  return null;
}

const BACKUP_KEY_PREFIX = "idb:";
const WAS_AUTHED_KEY = "wc_was_authed";

/** Sticky "this device has signed in before" flag — survives auth eviction. */
export function setWasAuthed(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(WAS_AUTHED_KEY, "1");
    else window.localStorage.removeItem(WAS_AUTHED_KEY);
  } catch { /* ignore */ }
  // Mirror to IndexedDB so it survives localStorage eviction.
  void idbSet(BACKUP_KEY_PREFIX + WAS_AUTHED_KEY, value ? "1" : null);
}

export function wasAuthed(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(WAS_AUTHED_KEY) === "1"; }
  catch { return false; }
}

/** Restore the wasAuthed flag from IndexedDB on launch. Best-effort. */
export async function restoreWasAuthedFromIdb(): Promise<void> {
  if (typeof window === "undefined") return;
  if (wasAuthed()) return;
  const v = await idbGet(BACKUP_KEY_PREFIX + WAS_AUTHED_KEY);
  if (v === "1") {
    try { window.localStorage.setItem(WAS_AUTHED_KEY, "1"); } catch { /* ignore */ }
  }
}

/**
 * Restore the Supabase auth token from IndexedDB into localStorage if
 * localStorage has been cleared (e.g. iOS 7-day eviction). Call this once,
 * as early as possible, before reading the session.
 */
export async function restoreAuthFromIdb(): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;

  // If localStorage already has an auth token, nothing to do.
  if (authStorageKey()) return;

  // Look for any backed-up sb-*-auth-token key in IndexedDB.
  try {
    const db = await openDb();
    const keys: string[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });
    for (const k of keys) {
      if (typeof k !== "string") continue;
      if (!k.startsWith(BACKUP_KEY_PREFIX)) continue;
      const realKey = k.slice(BACKUP_KEY_PREFIX.length);
      if (!(realKey.startsWith("sb-") && realKey.endsWith("-auth-token"))) continue;
      const value = await idbGet(k);
      if (value) {
        try {
          window.localStorage.setItem(realKey, value);
        } catch {
          /* ignore quota errors */
        }
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Mirror the current Supabase auth token from localStorage into IndexedDB.
 * Call after sign-in, sign-out, and token refresh.
 */
export async function backupAuthToIdb(): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  const key = authStorageKey();
  if (!key) {
    // No token in localStorage — clear any stale backups.
    try {
      const db = await openDb();
      const keys: string[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).getAllKeys();
        req.onsuccess = () => resolve(req.result as string[]);
        req.onerror = () => reject(req.error);
      });
      for (const k of keys) {
        if (typeof k === "string" && k.startsWith(BACKUP_KEY_PREFIX)) {
          await idbSet(k, null);
        }
      }
    } catch {
      /* ignore */
    }
    return;
  }
  const value = window.localStorage.getItem(key);
  if (value) await idbSet(BACKUP_KEY_PREFIX + key, value);
}
