"use client";

import { useSyncExternalStore } from "react";

import { createLocalStore, newLocalId } from "./localStore";

export type CustomerReview = {
    id: string;
    /** Identifies which purchased line this review answers. */
    productId: string;
    orderId: string;
    rating: number;
    title: string;
    body: string;
    createdAt: string;
    updatedAt?: string;
};

export type ReviewDraft = {
    productId: string;
    orderId: string;
    rating: number;
    title: string;
    body: string;
};

const store = createLocalStore<CustomerReview>("windrise-account-reviews");

/**
 * Reviews the customer has written.
 *
 * The *products* on the reviews page are real — they come from the customer's
 * own orders — and what is kept here is only what they wrote about them.
 * `ProductReview` on the server is keyed by a guest's phone number and has no
 * customer-scoped endpoint to read back, so the written half waits for one.
 */
export function useMyReviews(): CustomerReview[] {
    return useSyncExternalStore(store.subscribe, store.read, store.readServer);
}

/** One review per product, which is the rule the server's table enforces too. */
export function findReview(
    reviews: readonly CustomerReview[],
    productId: string,
): CustomerReview | undefined {
    return reviews.find((review) => review.productId === productId);
}

export function saveReview(draft: ReviewDraft): void {
    const rows = store.read();
    const existing = rows.find((row) => row.productId === draft.productId);

    if (existing) {
        store.write(
            rows.map((row) =>
                row.id === existing.id
                    ? { ...row, ...draft, updatedAt: new Date().toISOString() }
                    : row,
            ),
        );
        return;
    }

    store.write([
        ...rows,
        { ...draft, id: newLocalId(), createdAt: new Date().toISOString() },
    ]);
}

export function deleteReview(productId: string): void {
    store.write(store.read().filter((row) => row.productId !== productId));
}
