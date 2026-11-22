"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRightIcon, CheckCircle2Icon, Loader2Icon, SearchIcon, ShoppingBagIcon } from "lucide-react";

import type { Order, OrderStatus } from "@/types/order";
import { formatBdt, itemCount } from "@/utils/format";
import { getPaymentMethodDisplay, STATUS_META } from "@/utils/orderFlow";
import { AccountEmptyState } from "./AccountCard";
import { useMyOrders } from "./useMyOrders";

type Filter = "all" | "delivered" | "returned" | "cancelled";

const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "All Orders" },
    { id: "delivered", label: "Delivered" },
    { id: "returned", label: "Returned" },
    { id: "cancelled", label: "Cancelled" },
];

const DROPPED: OrderStatus[] = ["canceled", "failed", "expired"];

/** Short date, as the cards show it: "02 Sep, 2026". */
const shortDate = (input?: string | null) => {
    if (!input) return "—";
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

export function PurchaseHistoryView() {
    const { orders, loading, error } = useMyOrders();
    const [filter, setFilter] = useState<Filter>("all");
    const [query, setQuery] = useState("");
    const [newestFirst, setNewestFirst] = useState(true);

    const visible = useMemo(() => {
        const term = query.trim().toLowerCase();

        return orders
            .filter((order) => {
                if (filter === "delivered") return order.status === "delivered";
                if (filter === "cancelled") return DROPPED.includes(order.status);
                if (filter === "returned") return order.afterSales === "return";
                return true;
            })
            .filter((order) => {
                if (!term) return true;
                // Order number or any product on it, which is how a customer
                // actually looks for a past purchase.
                return (
                    order.orderNo.toLowerCase().includes(term) ||
                    order.items.some((item) => item.name.toLowerCase().includes(term))
                );
            })
            .sort((a, b) => {
                const left = new Date(a.placedAt).getTime();
                const right = new Date(b.placedAt).getTime();
                return newestFirst ? right - left : left - right;
            });
    }, [orders, filter, query, newestFirst]);

    if (loading) {
        return (
            <div className="flex min-h-[240px] items-center justify-center">
                <Loader2Icon className="h-5 w-5 animate-spin text-[#8f8f8f]" />
            </div>
        );
    }

    if (error) {
        return (
            <p className="py-16 text-center text-[13px] text-[#c0392b]">{error}</p>
        );
    }

    return (
        <div>
            <div className="flex flex-col gap-4 border-b border-[#ececec] pb-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-5">
                    {FILTERS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setFilter(item.id)}
                            aria-pressed={filter === item.id}
                            className={`relative pb-1 text-[12px] transition-colors ${
                                filter === item.id
                                    ? "font-medium text-[#1a1a1a]"
                                    : "text-[#8f8f8f] hover:text-[#1a1a1a]"
                            }`}
                        >
                            {item.label}
                            {filter === item.id && (
                                <span className="absolute -bottom-[17px] left-0 h-px w-full bg-[#1a1a1a]" />
                            )}
                        </button>
                    ))}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative">
                        <SearchIcon
                            aria-hidden="true"
                            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9a9a9a]"
                            strokeWidth={1.6}
                        />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search by Order ID or Product"
                            aria-label="Search orders"
                            className="w-full rounded-md border border-[#e0e0e0] py-2 pl-8 pr-3 text-[12px] text-[#1a1a1a] outline-none transition-colors focus-visible:border-[#1a1a1a] sm:w-[230px]"
                        />
                    </div>

                    <select
                        value={newestFirst ? "newest" : "oldest"}
                        onChange={(event) => setNewestFirst(event.target.value === "newest")}
                        aria-label="Sort orders"
                        className="rounded-md border border-[#e0e0e0] px-3 py-2 text-[12px] text-[#1a1a1a] outline-none focus-visible:border-[#1a1a1a]"
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                    </select>
                </div>
            </div>

            {visible.length === 0 ? (
                <AccountEmptyState
                    icon={<ShoppingBagIcon className="h-5 w-5" strokeWidth={1.5} />}
                    title={orders.length === 0 ? "That's all for now!" : "Nothing matches"}
                    description={
                        orders.length === 0
                            ? "You'll see your future purchases here."
                            : "Try a different search or filter."
                    }
                    action={
                        orders.length === 0 ? (
                            <Link
                                href="/"
                                className="mt-1 inline-flex items-center gap-2 rounded-md bg-[#1a1a1a] px-4 py-2.5 text-[11px] font-medium text-white transition-colors hover:bg-black"
                            >
                                Continue Shopping
                                <ArrowRightIcon className="h-3 w-3" strokeWidth={1.6} />
                            </Link>
                        ) : undefined
                    }
                />
            ) : (
                <div className="mt-6 space-y-5">
                    {visible.map((order) => (
                        <OrderCard key={order.id} order={order} />
                    ))}
                </div>
            )}
        </div>
    );
}

function OrderCard({ order }: { order: Order }) {
    const dropped = DROPPED.includes(order.status);
    const delivered = order.status === "delivered";
    // Passing the gateway too so an online order reads "bKash" rather than the
    // generic label, which is what the card is meant to show.
    const payment = getPaymentMethodDisplay(
        order.payment.method,
        order.payment.gateway ?? order.payment.gatewayLabel,
    );

    return (
        <article className="rounded-lg border border-[#e6e6e6] bg-white">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0f0f0] px-5 py-4">
                <div>
                    <h3 className="text-[14px] font-medium text-[#1a1a1a]">
                        Order #{order.orderNo}
                    </h3>
                    <p className="mt-1 text-[11px] text-[#8f8f8f]">
                        Placed on {shortDate(order.placedAt)} &middot;{" "}
                        {itemCount(order)} item{itemCount(order) === 1 ? "" : "s"} &middot;{" "}
                        {formatBdt(order.totalAmount)}
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <span
                        className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-medium ${
                            delivered
                                ? "bg-[#e8f6ec] text-[#1f7a3d]"
                                : dropped
                                  ? "bg-[#fdecea] text-[#c0392b]"
                                  : STATUS_META[order.status].chip
                        }`}
                    >
                        {delivered && (
                            <CheckCircle2Icon className="h-3 w-3" strokeWidth={2} />
                        )}
                        {STATUS_META[order.status].label}
                    </span>

                    <Link
                        href={`/order-tracking/${order.id}`}
                        className="flex items-center gap-1 text-[11px] text-[#1a1a1a] transition-opacity hover:opacity-70"
                    >
                        View Order Details
                        <ArrowRightIcon className="h-3 w-3" strokeWidth={1.6} />
                    </Link>
                </div>
            </header>

            <div className="grid gap-5 px-5 py-5 lg:grid-cols-[1fr_auto]">
                <ul className="space-y-4">
                    {order.items.map((item) => (
                        <li key={item.id} className="flex items-center gap-4">
                            <span className="relative h-[64px] w-[56px] shrink-0 overflow-hidden rounded bg-[#f2f2f2]">
                                {item.image && (
                                    <Image
                                        src={item.image}
                                        alt={item.name}
                                        fill
                                        sizes="56px"
                                        className="object-cover"
                                    />
                                )}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] text-[#1a1a1a]">
                                    {item.name}
                                </p>
                                <p className="mt-1 text-[11px] text-[#8f8f8f]">
                                    {item.size ? `Size: ${item.size}` : "One size"}
                                    {" · "}
                                    Qty: {item.quantity}
                                </p>
                            </div>
                            <span className="shrink-0 text-[13px] text-[#1a1a1a]">
                                {formatBdt(item.price)}
                            </span>
                        </li>
                    ))}
                </ul>

                <dl className="space-y-3 border-t border-[#f0f0f0] pt-4 text-[11px] lg:w-[180px] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                    <div>
                        <dt className="text-[#9a9a9a]">Total Amount</dt>
                        <dd className="mt-0.5 text-[15px] text-[#1a1a1a]">
                            {formatBdt(order.totalAmount)}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-[#9a9a9a]">Payment Method</dt>
                        <dd className="mt-0.5 text-[12px] text-[#1a1a1a]">
                            {payment.label}
                        </dd>
                    </div>
                    {delivered && (
                        <div>
                            <dt className="text-[#9a9a9a]">Delivered on</dt>
                            <dd className="mt-0.5 text-[12px] text-[#1a1a1a]">
                                {shortDate(order.updatedAt ?? order.placedAt)}
                            </dd>
                        </div>
                    )}
                </dl>
            </div>
        </article>
    );
}
