"use client";

import { useSyncExternalStore } from "react";

import { createLocalStore } from "./localStore";

/**
 * The parts of the profile form the server cannot yet hold.
 *
 * `PATCH /user/me` persists a customer's name and avatar and nothing else —
 * it writes `phone` only for staff roles, because the Customer table has no
 * such column, and it has no gender, date of birth or anniversary at all. So
 * those fields live here, while name and avatar go to the real endpoint.
 *
 * The name is split here and joined there: the design asks for First and Last
 * separately, the server stores one string, so the halves are kept so the form
 * can show them again and the join is what gets saved.
 */
export type ProfileDetails = {
    firstName: string;
    lastName: string;
    phone: string;
    gender: string;
    dateOfBirth: string;
    anniversary: string;
};

export const emptyProfileDetails: ProfileDetails = {
    firstName: "",
    lastName: "",
    phone: "",
    gender: "",
    dateOfBirth: "",
    anniversary: "",
};

// One row, but the same store as everything else so there is a single place
// where the temporary persistence lives.
const store = createLocalStore<ProfileDetails>("windrise-account-profile");

export function useProfileDetails(): ProfileDetails | null {
    const rows = useSyncExternalStore(store.subscribe, store.read, store.readServer);
    return rows[0] ?? null;
}

export function saveProfileDetails(details: ProfileDetails): void {
    store.write([details]);
}

/** Splits a stored full name into halves for a form that asks for both. */
export function splitName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: "", lastName: "" };
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    // Everything before the final word is the given name, so "Md Rifat
    // Hossain" reads as "Md Rifat" + "Hossain" rather than losing the middle.
    return {
        firstName: parts.slice(0, -1).join(" "),
        lastName: parts[parts.length - 1],
    };
}

export const joinName = (firstName: string, lastName: string): string =>
    [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");

/**
 * How much of the profile is filled in, as a percentage.
 *
 * Counted rather than hard-coded so the bar actually responds to the customer
 * completing something — the point of showing it.
 */
export function profileCompletion(input: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
    details: ProfileDetails | null;
    addressCount: number;
}): number {
    const details = input.details ?? emptyProfileDetails;
    const checks = [
        Boolean(input.name?.trim()),
        Boolean(input.email?.trim()),
        Boolean(input.avatar?.trim()),
        Boolean(details.phone.trim()),
        Boolean(details.gender.trim()),
        Boolean(details.dateOfBirth.trim()),
        input.addressCount > 0,
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
}

/**
 * The membership number shown under the customer's name.
 *
 * Derived from the account id rather than stored: there is no such column, and
 * inventing a counter that resets per browser would be worse than a stable
 * label the customer can quote at support and that always matches the account.
 */
export function customerReference(userId?: string | null): string {
    if (!userId) return "#WR-0000";
    const digits = userId.replace(/\D/g, "");
    const tail = (digits || userId.replace(/\W/g, "")).slice(-4).toUpperCase();
    return `#WR-${tail.padStart(4, "0")}`;
}
