/**
 * Browser-side wishlist: a list of product handles in localStorage.
 * Phase 7 moves this into the customer's account when they sign in.
 * Exposed as an external store so React can read it without hydration mismatches.
 */
const KEY = "bagru:wishlist:v1";
export const MAX_WISHLIST = 200;

const EMPTY: readonly string[] = Object.freeze([]);
let cache: readonly string[] | null = null;
const listeners = new Set<() => void>();

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const clean = data.filter(
      (x): x is string => typeof x === "string" && x.length > 0 && x.length <= 200,
    );
    return [...new Set(clean)].slice(0, MAX_WISHLIST);
  } catch {
    return [];
  }
}

function read(): readonly string[] {
  if (cache) return cache;
  try {
    cache = parse(window.localStorage.getItem(KEY));
  } catch {
    cache = []; // storage blocked (private mode etc.): wishlist works for this page view only
  }
  return cache;
}

function write(list: string[]) {
  cache = list;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: keep the in-memory copy */
  }
  listeners.forEach((l) => l());
}

export const wishlistStore = {
  getSnapshot: (): readonly string[] => read(),
  getServerSnapshot: (): readonly string[] => EMPTY,
  subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY || e.key === null) {
        cache = null;
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
  has: (handle: string) => read().includes(handle),
  /** Adds the handle if missing (newest first), removes it if present. Returns the new state. */
  toggle(handle: string): boolean {
    const list = [...read()];
    const i = list.indexOf(handle);
    if (i >= 0) {
      list.splice(i, 1);
      write(list);
      return false;
    }
    write([handle, ...list].slice(0, MAX_WISHLIST));
    return true;
  },
  remove(handle: string) {
    write(read().filter((h) => h !== handle));
  },
  /** Test helper: forget the in-memory copy. */
  _reset() {
    cache = null;
  },
};
