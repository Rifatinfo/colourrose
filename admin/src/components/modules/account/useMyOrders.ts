"use client";

import { useEffect, useState } from "react";

import type { Order } from "@/types/order";
import { getMyOrders } from "@/services/order/order";
import { mapServerOrdersToUi } from "@/lib/orderMapper";

export type MyOrdersState = {
    orders: Order[];
    loading: boolean;
    error: string;
};

/**
 * The signed-in customer's orders.
 *
 * Purchase History and Track Order are the same rows read two ways, so the
 * fetch lives here rather than being written out twice and drifting.
 */
export function useMyOrders(): MyOrdersState {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        getMyOrders()
            .then((res) => {
                if (!cancelled) setOrders(mapServerOrdersToUi(res.data ?? []));
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setError(
                        err instanceof Error ? err.message : "Failed to load your orders.",
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return { orders, loading, error };
}
