import type { Product } from "@/types/product";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Product lookup for the dashboard's order builder.
 *
 * Goes to the product list rather than `/product/search`: the order needs each
 * product's **variants**, because the create-order endpoint matches a line to
 * a variant on colour and size exactly and refuses one that has no stock. The
 * search projection does not carry them; `GET /product` does.
 *
 * `searchTerm` covers name and SKU server-side, which is how someone taking an
 * order over the phone will look — by what the customer calls it, or by the
 * code off a tag.
 */
export async function searchProductsForOrder(
    term: string,
    signal?: AbortSignal,
): Promise<Product[]> {
    const trimmed = term.trim();
    if (!trimmed) return [];

    const query = new URLSearchParams({ searchTerm: trimmed, limit: "8" });

    try {
        const res = await fetch(`${API_URL}/api/v1/product?${query.toString()}`, {
            credentials: "include",
            cache: "no-store",
            signal,
        });
        if (!res.ok) return [];

        const body = await res.json();
        return Array.isArray(body?.data) ? (body.data as Product[]) : [];
    } catch {
        // An aborted keystroke is the common case here, not a failure worth
        // showing: the next one is already in flight.
        return [];
    }
}
