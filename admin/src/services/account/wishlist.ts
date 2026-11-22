"use client";

import { useSyncExternalStore } from "react";

import { createLocalStore } from "./localStore";

export type WishlistItem = {
    /** The product's own id, which is also the row's identity: one entry each. */
    productId: string;
    name: string;
    slug?: string;
    href?: string;
    image: string;
    price: number;
    colorName?: string;
    sizes?: string[];
    addedAt: string;
};

/**
 * Rows are only as good as the product they were saved from.
 *
 * A card whose price had not resolved wrote a row with no `price`, and the
 * list then crashed formatting it — and because the row is in the browser for
 * good, blocking new bad writes would not have fixed the visit it broke. So
 * the repair happens on the way out: anything without an id is dropped (it can
 * never be matched, removed or linked), and everything else is forced into the
 * shape the page renders.
 */
const sanitizeWishlist = (rows: unknown[]): WishlistItem[] =>
    rows.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const item = row as Partial<WishlistItem>;
        if (typeof item.productId !== "string" || !item.productId) return [];

        const price = Number(item.price);

        return [
            {
                productId: item.productId,
                name: typeof item.name === "string" ? item.name : "Product",
                slug: item.slug,
                href: item.href,
                image: typeof item.image === "string" ? item.image : "",
                price: Number.isFinite(price) ? price : 0,
                colorName: item.colorName,
                sizes: Array.isArray(item.sizes) ? item.sizes : undefined,
                addedAt:
                    typeof item.addedAt === "string"
                        ? item.addedAt
                        : new Date(0).toISOString(),
            },
        ];
    });

const store = createLocalStore<WishlistItem>(
    "windrise-wishlist",
    sanitizeWishlist,
);

export function useWishlist(): WishlistItem[] {
    return useSyncExternalStore(store.subscribe, store.read, store.readServer);
}

/**
 * Whether a product is saved. Subscribes the same way the list does, so the
 * heart on a card fills the moment the product is saved from anywhere else on
 * the page.
 */
export function useIsWishlisted(productId: string): boolean {
    const items = useSyncExternalStore(store.subscribe, store.read, store.readServer);
    return items.some((item) => item.productId === productId);
}

export function addToWishlist(item: Omit<WishlistItem, "addedAt">): void {
    // The other half of the repair above: refuse the row rather than persist
    // something the list cannot render or remove again.
    if (!item.productId) return;

    const rows = store.read();
    if (rows.some((row) => row.productId === item.productId)) return;

    const price = Number(item.price);
    store.write([
        {
            ...item,
            price: Number.isFinite(price) ? price : 0,
            addedAt: new Date().toISOString(),
        },
        ...rows,
    ]);
}

export function removeFromWishlist(productId: string): void {
    store.write(store.read().filter((row) => row.productId !== productId));
}

export function toggleWishlist(item: Omit<WishlistItem, "addedAt">): void {
    const rows = store.read();
    if (rows.some((row) => row.productId === item.productId)) {
        removeFromWishlist(item.productId);
        return;
    }
    addToWishlist(item);
}
