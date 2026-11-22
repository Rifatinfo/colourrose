"use client";

/**
 * A small browser-backed collection store.
 *
 * ------------------------------------------------------------------------
 * TEMPORARY BACKING. Addresses, the wishlist and review drafts have no
 * tables and no endpoints yet — the Prisma schema has no Address or Wishlist
 * model, and ProductReview is keyed by a guest's phone number rather than a
 * customer. Rather than render those sections dead, each one is written
 * against a typed service whose functions are shaped like the API calls that
 * will replace them, and this holds the rows in the meantime.
 *
 * What that costs, stated plainly: rows live in one browser. They do not
 * follow the customer to another device and the server cannot see them. When
 * the endpoints land, the swap is the body of each function in the service
 * beside this file — no component changes.
 * ------------------------------------------------------------------------
 *
 * `useSyncExternalStore` needs a snapshot that is referentially stable
 * between writes, or React re-renders forever. The parsed array is cached
 * against the raw string it came from, so repeated reads with nothing changed
 * hand back the very same array.
 */

type Listener = () => void;

export type LocalStore<T> = {
    read: () => T[];
    /**
     * The snapshot for the server render and the first client render.
     *
     * Must hand back the *same* array every call. Returning a fresh `[]`
     * makes React see a new snapshot on every check and re-render forever —
     * which is exactly what "The result of getServerSnapshot should be cached
     * to avoid an infinite loop" is telling you.
     */
    readServer: () => T[];
    write: (rows: T[]) => void;
    subscribe: (listener: Listener) => () => void;
};

/**
 * @param sanitize Optional pass over freshly parsed rows, to drop or repair
 *   anything unusable. It runs where the parse is cached — once per change to
 *   the stored string, never per read — so the snapshot stays referentially
 *   stable and `useSyncExternalStore` does not spin.
 *
 *   Worth having because what lands here is permanent for that browser: a row
 *   written with a missing field stays broken across every future visit, and
 *   nothing server-side will ever correct it. Cleaning on the way out is the
 *   only place a fix can reach data that is already stored.
 */
export function createLocalStore<T>(
    storageKey: string,
    sanitize?: (rows: unknown[]) => T[],
): LocalStore<T> {
    const empty: T[] = [];
    const listeners = new Set<Listener>();

    let cachedRaw: string | null = null;
    let cachedRows: T[] = empty;

    const read = (): T[] => {
        if (typeof window === "undefined") return empty;

        let raw: string | null = null;
        try {
            raw = window.localStorage.getItem(storageKey);
        } catch {
            // Private windows and "block site data" both throw on access.
            return empty;
        }

        if (raw === null) return empty;
        if (raw === cachedRaw) return cachedRows;

        try {
            const parsed = JSON.parse(raw);
            cachedRaw = raw;

            if (!Array.isArray(parsed)) {
                cachedRows = empty;
            } else {
                const rows = sanitize ? sanitize(parsed) : (parsed as T[]);
                // Keep the shared reference when a clean-up empties the list,
                // so "nothing usable" and "nothing stored" are the same value.
                cachedRows = rows.length === 0 ? empty : rows;
            }
        } catch {
            cachedRaw = raw;
            cachedRows = empty;
        }
        return cachedRows;
    };

    const write = (rows: T[]) => {
        try {
            const raw = JSON.stringify(rows);
            window.localStorage.setItem(storageKey, raw);
            cachedRaw = raw;
            cachedRows = rows;
        } catch {
            // Out of quota, or storage is blocked. The in-memory copy still
            // updates so the current page stays consistent with itself.
            cachedRaw = null;
            cachedRows = rows;
        }
        listeners.forEach((listener) => listener());
    };

    const subscribe = (listener: Listener) => {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    };

    // One array for the life of the store, shared by `read`'s empty cases and
    // by the server snapshot, so "nothing stored" is always the same reference.
    return { read, readServer: () => empty, write, subscribe };
}

/** Ids only need to be unique within one browser, which this is. */
export const newLocalId = (): string =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
