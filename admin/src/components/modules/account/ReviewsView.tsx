"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
    ClockIcon,
    Loader2Icon,
    MessageSquareIcon,
    PencilIcon,
    PlusIcon,
    StarIcon,
    Trash2Icon,
} from "lucide-react";

import { Toast } from "@/components/shared/Toast/Toast";
import {
    deleteReview,
    findReview,
    saveReview,
    useMyReviews,
    type CustomerReview,
} from "@/services/account/reviews";
import { AccountEmptyState } from "./AccountCard";
import { useMyOrders } from "./useMyOrders";

type Tab = "all" | "reviewed" | "pending";

/** A product the customer has bought, which is what earns the right to review. */
type Purchased = {
    productId: string;
    orderId: string;
    name: string;
    image?: string | null;
    size?: string | null;
    color?: string | null;
};

const shortDate = (input: string) =>
    new Date(input).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });

export function ReviewsView() {
    const { orders, loading, error } = useMyOrders();
    const reviews = useMyReviews();
    const [tab, setTab] = useState<Tab>("all");
    const [editing, setEditing] = useState<string | null>(null);

    /**
     * Every distinct product the customer has bought, newest order first.
     *
     * Deduplicated by product: buying the same item twice still earns one
     * voice, which is the rule the server's review table enforces as well.
     */
    const purchased = useMemo(() => {
        const seen = new Map<string, Purchased>();

        [...orders]
            .sort(
                (a, b) =>
                    new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime(),
            )
            .forEach((order) => {
                order.items.forEach((item) => {
                    const key = item.id || item.name;
                    if (seen.has(key)) return;
                    seen.set(key, {
                        productId: key,
                        orderId: order.id,
                        name: item.name,
                        image: item.image,
                        size: item.size,
                        color: item.color,
                    });
                });
            });

        return [...seen.values()];
    }, [orders]);

    const reviewedCount = purchased.filter((product) =>
        findReview(reviews, product.productId),
    ).length;

    const visible = purchased.filter((product) => {
        const review = findReview(reviews, product.productId);
        if (tab === "reviewed") return Boolean(review);
        if (tab === "pending") return !review;
        return true;
    });

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

    const TABS: { id: Tab; label: string }[] = [
        { id: "all", label: `All (${purchased.length})` },
        { id: "reviewed", label: `Reviewed (${reviewedCount})` },
        { id: "pending", label: `Pending (${purchased.length - reviewedCount})` },
    ];

    return (
        <div>
            <div className="flex flex-wrap items-center gap-5 border-b border-[#ececec] pb-4">
                {TABS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setTab(item.id)}
                        aria-pressed={tab === item.id}
                        className={`relative pb-1 text-[12px] transition-colors ${
                            tab === item.id
                                ? "font-medium text-[#1a1a1a]"
                                : "text-[#8f8f8f] hover:text-[#1a1a1a]"
                        }`}
                    >
                        {item.label}
                        {tab === item.id && (
                            <span className="absolute -bottom-[17px] left-0 h-px w-full bg-[#1a1a1a]" />
                        )}
                    </button>
                ))}
            </div>

            {visible.length === 0 ? (
                <AccountEmptyState
                    icon={<MessageSquareIcon className="h-5 w-5" strokeWidth={1.5} />}
                    title={
                        purchased.length === 0
                            ? "Nothing to review yet"
                            : "Nothing in this tab"
                    }
                    description={
                        purchased.length === 0
                            ? "Products you have bought will appear here, ready to review."
                            : "Try another tab to see the rest of your purchases."
                    }
                />
            ) : (
                <div className="mt-6 space-y-4">
                    {visible.map((product) => (
                        <ReviewRow
                            key={product.productId}
                            product={product}
                            review={findReview(reviews, product.productId)}
                            editing={editing === product.productId}
                            onEdit={() => setEditing(product.productId)}
                            onClose={() => setEditing(null)}
                        />
                    ))}
                </div>
            )}

            <div className="mt-10 flex flex-col items-center gap-2 border-t border-[#f0f0f0] pt-8 text-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f4f4] text-[#5f5f5f]">
                    <MessageSquareIcon className="h-4 w-4" strokeWidth={1.5} />
                </span>
                <p className="text-[13px] font-medium text-[#1a1a1a]">
                    Thanks for being a part of Windrise
                </p>
                <p className="text-[11px] text-[#8f8f8f]">Your reviews make a difference.</p>
            </div>
        </div>
    );
}

function ReviewRow({
    product,
    review,
    editing,
    onEdit,
    onClose,
}: {
    product: Purchased;
    review?: CustomerReview;
    editing: boolean;
    onEdit: () => void;
    onClose: () => void;
}) {
    const [rating, setRating] = useState(review?.rating ?? 5);
    const [title, setTitle] = useState(review?.title ?? "");
    const [body, setBody] = useState(review?.body ?? "");

    const submit = () => {
        if (!body.trim()) {
            Toast.fire({ icon: "error", title: "Please write a few words." });
            return;
        }
        saveReview({
            productId: product.productId,
            orderId: product.orderId,
            rating,
            title: title.trim(),
            body: body.trim(),
        });
        Toast.fire({ icon: "success", title: "Review saved." });
        onClose();
    };

    return (
        <article className="rounded-lg border border-[#e6e6e6] bg-white p-4">
            <div className="flex flex-col gap-4 sm:flex-row">
                <span className="relative h-[130px] w-full shrink-0 overflow-hidden rounded bg-[#f2f2f2] sm:h-[104px] sm:w-[92px]">
                    {product.image && (
                        <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            sizes="(max-width: 640px) 100vw, 92px"
                            className="object-cover"
                        />
                    )}
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="truncate text-[14px] font-medium text-[#1a1a1a]">
                                {product.name}
                            </h3>
                            <p className="mt-0.5 text-[11px] text-[#8f8f8f]">
                                {[product.color, product.size && `Size ${product.size}`]
                                    .filter(Boolean)
                                    .join("  ·  ") || "One size"}
                            </p>
                        </div>

                        <span
                            className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-medium ${
                                review
                                    ? "bg-[#e8f6ec] text-[#1f7a3d]"
                                    : "bg-[#fdf3e3] text-[#9a7b4f]"
                            }`}
                        >
                            {review ? (
                                <StarIcon className="h-3 w-3 fill-current" strokeWidth={0} />
                            ) : (
                                <ClockIcon className="h-3 w-3" strokeWidth={1.8} />
                            )}
                            {review ? "Reviewed" : "Not Reviewed Yet"}
                        </span>
                    </div>

                    {editing ? (
                        <form
                            className="mt-4"
                            onSubmit={(event) => {
                                event.preventDefault();
                                submit();
                            }}
                        >
                            <div
                                className="flex items-center gap-1"
                                role="radiogroup"
                                aria-label="Rating"
                            >
                                {[1, 2, 3, 4, 5].map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        role="radio"
                                        aria-checked={rating === value}
                                        aria-label={`${value} star${value === 1 ? "" : "s"}`}
                                        onClick={() => setRating(value)}
                                        className="p-0.5"
                                    >
                                        <StarIcon
                                            className={`h-4 w-4 ${
                                                value <= rating
                                                    ? "fill-[#1a1a1a] text-[#1a1a1a]"
                                                    : "text-[#c9c9c9]"
                                            }`}
                                            strokeWidth={1.5}
                                        />
                                    </button>
                                ))}
                            </div>

                            <input
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder="Sum it up in a line"
                                className="mt-3 w-full rounded-md border border-[#e0e0e0] px-3 py-2 text-[13px] text-[#1a1a1a] outline-none transition-colors focus-visible:border-[#1a1a1a]"
                            />
                            <textarea
                                value={body}
                                onChange={(event) => setBody(event.target.value)}
                                rows={3}
                                placeholder="What did you think of it?"
                                className="mt-2 w-full resize-y rounded-md border border-[#e0e0e0] px-3 py-2 text-[13px] text-[#1a1a1a] outline-none transition-colors focus-visible:border-[#1a1a1a]"
                            />

                            <div className="mt-3 flex items-center gap-2">
                                <button
                                    type="submit"
                                    className="rounded-md bg-[#1a1a1a] px-4 py-2 text-[11px] font-medium text-white transition-colors hover:bg-black"
                                >
                                    {review ? "Update Review" : "Submit Review"}
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="rounded-md border border-[#e0e0e0] px-4 py-2 text-[11px] text-[#4a4a4a] transition-colors hover:bg-[#f5f5f5]"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    ) : review ? (
                        <>
                            <div className="mt-3 flex items-center gap-2">
                                <span className="flex" aria-label={`${review.rating} out of 5`}>
                                    {[1, 2, 3, 4, 5].map((value) => (
                                        <StarIcon
                                            key={value}
                                            aria-hidden="true"
                                            className={`h-3.5 w-3.5 ${
                                                value <= review.rating
                                                    ? "fill-[#1a1a1a] text-[#1a1a1a]"
                                                    : "text-[#d5d5d5]"
                                            }`}
                                            strokeWidth={1.5}
                                        />
                                    ))}
                                </span>
                                <span className="text-[11px] text-[#8f8f8f]">
                                    {shortDate(review.updatedAt ?? review.createdAt)}
                                </span>
                            </div>

                            {review.title && (
                                <p className="mt-2 text-[13px] font-medium text-[#1a1a1a]">
                                    {review.title}
                                </p>
                            )}
                            <p className="mt-1 text-[12px] leading-relaxed text-[#6f6f6f]">
                                {review.body}
                            </p>

                            <div className="mt-4 flex flex-wrap justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={onEdit}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-[#e0e0e0] px-3 py-2 text-[11px] text-[#4a4a4a] transition-colors hover:bg-[#f5f5f5]"
                                >
                                    <PencilIcon className="h-3 w-3" strokeWidth={1.6} />
                                    Edit Review
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        deleteReview(product.productId);
                                        Toast.fire({ icon: "success", title: "Review deleted." });
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-[#e0e0e0] px-3 py-2 text-[11px] text-[#4a4a4a] transition-colors hover:border-[#e6b8b3] hover:text-[#c0392b]"
                                >
                                    <Trash2Icon className="h-3 w-3" strokeWidth={1.6} />
                                    Delete
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-[12px] text-[#8f8f8f]">
                                Share your thoughts about this product.
                            </p>
                            <button
                                type="button"
                                onClick={onEdit}
                                className="inline-flex items-center gap-1.5 rounded-md bg-[#1a1a1a] px-4 py-2.5 text-[11px] font-medium text-white transition-colors hover:bg-black"
                            >
                                <PlusIcon className="h-3 w-3" strokeWidth={2} />
                                Write a Review
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </article>
    );
}
