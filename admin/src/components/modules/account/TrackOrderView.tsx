"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
    ArrowRightIcon,
    CheckIcon,
    HeadphonesIcon,
    Loader2Icon,
    PackageIcon,
    SearchIcon,
    TruckIcon,
} from "lucide-react";

import type { Order, OrderStatus } from "@/types/order";
import { formatBdt, itemCount } from "@/utils/format";
import { PIPELINE, STATUS_META } from "@/utils/orderFlow";
import { AccountEmptyState } from "./AccountCard";
import { useMyOrders } from "./useMyOrders";

type Filter = "all" | "processing" | "shipped" | "delivered" | "canceled";

const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "All Orders" },
    { id: "processing", label: "Processing" },
    { id: "shipped", label: "Shipped" },
    { id: "delivered", label: "Delivered" },
    { id: "canceled", label: "Canceled" },
];

const DROPPED: OrderStatus[] = ["canceled", "failed", "expired"];

const shortDate = (input?: string | null) => {
    if (!input) return "–";
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return "–";
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

export function TrackOrderView() {
    const { orders, loading, error } = useMyOrders();
    const [filter, setFilter] = useState<Filter>("all");
    const [query, setQuery] = useState("");
    const [newestFirst, setNewestFirst] = useState(true);

    const visible = useMemo(() => {
        const term = query.trim().toLowerCase();

        return orders
            .filter((order) => {
                if (filter === "processing") {
                    return ["placed", "confirmed", "processed"].includes(order.status);
                }
                if (filter === "shipped") return order.status === "on_the_way";
                if (filter === "delivered") return order.status === "delivered";
                if (filter === "canceled") return DROPPED.includes(order.status);
                return true;
            })
            .filter((order) =>
                term ? order.orderNo.toLowerCase().includes(term) : true,
            )
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
        return <p className="py-16 text-center text-[13px] text-[#c0392b]">{error}</p>;
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
                            placeholder="Search by Order ID"
                            aria-label="Search orders"
                            className="w-full rounded-md border border-[#e0e0e0] py-2 pl-8 pr-3 text-[12px] text-[#1a1a1a] outline-none transition-colors focus-visible:border-[#1a1a1a] sm:w-[200px]"
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
                    icon={<PackageIcon className="h-5 w-5" strokeWidth={1.5} />}
                    title={orders.length === 0 ? "No orders to track" : "Nothing matches"}
                    description={
                        orders.length === 0
                            ? "Once you place an order you can follow it from here."
                            : "Try a different search or filter."
                    }
                    action={
                        orders.length === 0 ? (
                            <Link
                                href="/"
                                className="mt-1 inline-flex items-center gap-2 rounded-md bg-[#1a1a1a] px-4 py-2.5 text-[11px] font-medium text-white transition-colors hover:bg-black"
                            >
                                Start Shopping
                                <ArrowRightIcon className="h-3 w-3" strokeWidth={1.6} />
                            </Link>
                        ) : undefined
                    }
                />
            ) : (
                <div className="mt-6 space-y-5">
                    {visible.map((order) => (
                        <TrackingCard key={order.id} order={order} />
                    ))}
                </div>
            )}

            <div className="mt-10 flex flex-col items-center gap-2 border-t border-[#f0f0f0] pt-8 text-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f4f4] text-[#5f5f5f]">
                    <HeadphonesIcon className="h-4 w-4" strokeWidth={1.5} />
                </span>
                <p className="text-[13px] font-medium text-[#1a1a1a]">
                    Need help with your order?
                </p>
                <p className="text-[11px] text-[#8f8f8f]">
                    Our support team is here to assist you.
                </p>
                <Link
                    href="/order-tracking"
                    className="mt-2 rounded-md border border-[#dcdcdc] px-4 py-2 text-[11px] text-[#1a1a1a] transition-colors hover:bg-[#f5f5f5]"
                >
                    Contact Support
                </Link>
            </div>
        </div>
    );
}

function TrackingCard({ order }: { order: Order }) {
    const dropped = DROPPED.includes(order.status);
    const currentIndex = PIPELINE.indexOf(order.status);

    /**
     * The five milestones, with only the dates we actually hold.
     *
     * `/order/my-orders` carries no status history and the customer tracking
     * endpoint returns just the current status, so the order's own date sits
     * on "Placed", its last-updated date sits on the stage it has reached, and
     * everything else shows a dash. Spacing the stages out across invented
     * timestamps would read as fact.
     */
    const steps = PIPELINE.map((stage, index) => {
        const reached = !dropped && index <= currentIndex;
        let at: string | null = null;
        if (index === 0) at = order.placedAt;
        else if (index === currentIndex) at = order.updatedAt ?? null;

        return {
            stage,
            label: STATUS_META[stage].label,
            reached,
            current: !dropped && index === currentIndex,
            at,
        };
    });

    return (
        <article className="rounded-lg border border-[#e6e6e6] bg-white">
            <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
                <div>
                    <h3 className="text-[14px] font-medium text-[#1a1a1a]">
                        Order #{order.orderNo}
                    </h3>
                    <p className="mt-1 text-[11px] text-[#8f8f8f]">
                        Placed on{" "}
                        {new Date(order.placedAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                        })}{" "}
                        &middot; {itemCount(order)} item
                        {itemCount(order) === 1 ? "" : "s"} &middot;{" "}
                        {formatBdt(order.totalAmount)}
                    </p>
                </div>

                <span
                    className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-medium ${
                        dropped
                            ? "bg-[#fdecea] text-[#c0392b]"
                            : order.status === "delivered"
                              ? "bg-[#e8f6ec] text-[#1f7a3d]"
                              : "bg-[#eaf4ee] text-[#2c7a4b]"
                    }`}
                >
                    <TruckIcon className="h-3 w-3" strokeWidth={1.8} />
                    {STATUS_META[order.status].label}
                </span>
            </header>

            {/* Horizontal on desktop, vertical on a phone — the same five
                milestones either way, never a squeezed row of five labels. */}
            <div className="px-5 py-6">
                <ol className="hidden sm:flex sm:items-start">
                    {steps.map((step, index) => (
                        <li
                            key={step.stage}
                            className="relative flex flex-1 flex-col items-center text-center"
                        >
                            {index > 0 && (
                                <span
                                    aria-hidden="true"
                                    className={`absolute right-1/2 top-[9px] h-px w-full ${
                                        step.reached
                                            ? "bg-[#1a1a1a]"
                                            : "border-t border-dashed border-[#d4d4d4]"
                                    }`}
                                />
                            )}
                            <span
                                className={`relative z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full border ${
                                    step.reached
                                        ? "border-[#1a1a1a] bg-[#1a1a1a] text-white"
                                        : "border-[#d4d4d4] bg-white"
                                }`}
                            >
                                {step.reached && !step.current && (
                                    <CheckIcon className="h-2.5 w-2.5" strokeWidth={3} />
                                )}
                            </span>
                            <span
                                className={`mt-2 text-[11px] ${
                                    step.reached ? "text-[#1a1a1a]" : "text-[#a5a5a5]"
                                }`}
                            >
                                {step.label}
                            </span>
                            <span className="mt-0.5 text-[10px] text-[#a5a5a5]">
                                {shortDate(step.at)}
                            </span>
                        </li>
                    ))}
                </ol>

                <ol className="space-y-3 sm:hidden">
                    {steps.map((step) => (
                        <li key={step.stage} className="flex items-center gap-3">
                            <span
                                className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full border ${
                                    step.reached
                                        ? "border-[#1a1a1a] bg-[#1a1a1a] text-white"
                                        : "border-[#d4d4d4] bg-white"
                                }`}
                            >
                                {step.reached && !step.current && (
                                    <CheckIcon className="h-2 w-2" strokeWidth={3} />
                                )}
                            </span>
                            <span
                                className={`flex-1 text-[12px] ${
                                    step.reached ? "text-[#1a1a1a]" : "text-[#a5a5a5]"
                                }`}
                            >
                                {step.label}
                            </span>
                            <span className="text-[10px] text-[#a5a5a5]">
                                {shortDate(step.at)}
                            </span>
                        </li>
                    ))}
                </ol>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4 border-t border-[#f0f0f0] px-5 py-5">
                <ul className="space-y-3">
                    {order.items.map((item) => (
                        <li key={item.id} className="flex items-center gap-3">
                            <span className="relative h-[46px] w-[42px] shrink-0 overflow-hidden rounded bg-[#f2f2f2]">
                                {item.image && (
                                    <Image
                                        src={item.image}
                                        alt={item.name}
                                        fill
                                        sizes="42px"
                                        className="object-cover"
                                    />
                                )}
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-[12px] text-[#1a1a1a]">
                                    {item.name}
                                </p>
                                <p className="mt-0.5 text-[10px] text-[#8f8f8f]">
                                    {item.size ? `Size: ${item.size}` : "One size"} · Qty:{" "}
                                    {item.quantity}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>

                <Link
                    href={`/order-tracking/${order.id}`}
                    className="inline-flex items-center gap-2 rounded-md bg-[#1a1a1a] px-4 py-2.5 text-[11px] font-medium text-white transition-colors hover:bg-black"
                >
                    View Details
                    <ArrowRightIcon className="h-3 w-3" strokeWidth={1.6} />
                </Link>
            </div>
        </article>
    );
}
