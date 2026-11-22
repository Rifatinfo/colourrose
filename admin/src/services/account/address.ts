"use client";

import { useSyncExternalStore } from "react";

import { createLocalStore, newLocalId } from "./localStore";

export type CustomerAddress = {
    id: string;
    /** "Home", "Office", or whatever the customer types. */
    label: string;
    country: string;
    division: string;
    district: string;
    postalCode: string;
    addressLine: string;
    /** Optional second line, as checkout offers — flat, block, landmark. */
    addressLine2?: string;
    isDefault: boolean;
};

export type AddressDraft = Omit<CustomerAddress, "id" | "isDefault">;

const store = createLocalStore<CustomerAddress>("windrise-account-addresses");

/** Reads the customer's saved addresses, newest kept in insertion order. */
export function useAddresses(): CustomerAddress[] {
    return useSyncExternalStore(store.subscribe, store.read, store.readServer);
}

export function listAddresses(): CustomerAddress[] {
    return store.read();
}

export function createAddress(draft: AddressDraft): CustomerAddress {
    const rows = store.read();
    const address: CustomerAddress = {
        ...draft,
        id: newLocalId(),
        // The first address a customer saves is the one orders should default
        // to; asking them to then mark it default would be a step with only
        // one possible answer.
        isDefault: rows.length === 0,
    };
    store.write([...rows, address]);
    return address;
}

export function updateAddress(id: string, draft: AddressDraft): void {
    store.write(
        store.read().map((row) => (row.id === id ? { ...row, ...draft } : row)),
    );
}

export function deleteAddress(id: string): void {
    const remaining = store.read().filter((row) => row.id !== id);

    // Deleting the default would otherwise leave the customer with addresses
    // but nothing marked, so the next one inherits it.
    if (remaining.length > 0 && !remaining.some((row) => row.isDefault)) {
        remaining[0] = { ...remaining[0], isDefault: true };
    }
    store.write(remaining);
}

export function setDefaultAddress(id: string): void {
    store.write(
        store.read().map((row) => ({ ...row, isDefault: row.id === id })),
    );
}
