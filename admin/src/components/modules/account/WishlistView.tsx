"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRightIcon, HeartIcon, ShoppingBagIcon, Trash2Icon } from "lucide-react";

import { useCart } from "@/contexts/CartContext";
import { Toast } from "@/components/shared/Toast/Toast";
import {
    removeFromWishlist,
    useWishlist,
    type WishlistItem,
} from "@/services/account/wishlist";
import { AccountEmptyState } from "./AccountCard";

export function WishlistView() {
    const items = useWishlist();
    const [newestFirst, setNewestFirst] = useState(true);

    const sorted = useMemo(
        () =>
            [...items].sort((a, b) => {
                const left = new Date(a.addedAt).getTime();
                const right = new Date(b.addedAt).getTime();
                return newestFirst ? right - left : left - right;
            }),
        [items, newestFirst],
    );

    if (items.length === 0) {
        return (
            <AccountEmptyState
                icon={<HeartIcon className="h-5 w-5" strokeWidth={1.5} />}
                title="That's all for now."
                description="Save your favorite products to see them here."
                action={
                    <Link
                        href="/"
                        className="mt-1 inline-flex items-center gap-2 rounded-md border border-[#dcdcdc] px-4 py-2.5 text-[11px] text-[#1a1a1a] transition-colors hover:bg-[#f5f5f5]"
                    >
                        Continue Shopping
                        <ArrowRightIcon className="h-3 w-3" strokeWidth={1.6} />
                    </Link>
                }
            />
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12px] text-[#1a1a1a]">
                    {items.length} Item{items.length === 1 ? "" : "s"}
                </p>
                <label className="flex items-center gap-2 text-[11px] text-[#8f8f8f]">
                    Sort by
                    <select
                        value={newestFirst ? "recent" : "oldest"}
                        onChange={(event) => setNewestFirst(event.target.value === "recent")}
                        className="rounded-md border border-[#e0e0e0] px-3 py-2 text-[12px] text-[#1a1a1a] outline-none focus-visible:border-[#1a1a1a]"
                    >
                        <option value="recent">Recently Added</option>
                        <option value="oldest">Oldest First</option>
                    </select>
                </label>
            </div>

            <div className="mt-5 space-y-4">
                {sorted.map((item) => (
                    <WishlistRow key={item.productId} item={item} />
                ))}
            </div>
        </div>
    );
}

function WishlistRow({ item }: { item: WishlistItem }) {
    const { addItem } = useCart();
    const sizes = item.sizes ?? [];
    const [size, setSize] = useState<string | undefined>(sizes[0]);

    const addToBag = () => {
        addItem({
            productId: item.productId,
            name: item.name,
            sku: item.productId,
            size,
            color: item.colorName,
            price: item.price,
            image: item.image,
            quantity: 1,
        });
        Toast.fire({ icon: "success", title: `${item.name} added to your bag.` });
    };

    return (
        <article className="flex flex-col gap-4 rounded-lg border border-[#e6e6e6] bg-white p-4 sm:flex-row sm:items-center">
            <Link
                href={item.href ?? "/"}
                className="relative h-[150px] w-full shrink-0 overflow-hidden rounded bg-[#f2f2f2] sm:h-[120px] sm:w-[110px]"
            >
                {item.image && (
                    <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="(max-width: 640px) 100vw, 110px"
                        className="object-cover"
                    />
                )}
            </Link>

            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <Link
                            href={item.href ?? "/"}
                            className="block truncate text-[14px] text-[#1a1a1a] transition-opacity hover:opacity-70"
                        >
                            {item.name}
                        </Link>
                        <p className="mt-1 text-[14px] text-[#1a1a1a]">
                            Tk {item.price.toLocaleString("en-BD")}
                        </p>
                        {item.colorName && (
                            <p className="mt-0.5 text-[11px] text-[#8f8f8f]">
                                {item.colorName}
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            removeFromWishlist(item.productId);
                            Toast.fire({
                                icon: "success",
                                title: `${item.name} removed from your wishlist.`,
                            });
                        }}
                        aria-label={`Remove ${item.name} from wishlist`}
                        className="shrink-0 p-1 text-[#8f8f8f] transition-colors hover:text-[#c0392b]"
                    >
                        <Trash2Icon className="h-4 w-4" strokeWidth={1.6} />
                    </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    {sizes.length > 0 ? (
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Size">
                            {sizes.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setSize(option)}
                                    aria-pressed={size === option}
                                    className={`min-w-[38px] rounded border px-2 py-1.5 text-[11px] transition-colors ${
                                        size === option
                                            ? "border-[#1a1a1a] text-[#1a1a1a]"
                                            : "border-[#e0e0e0] text-[#6f6f6f] hover:border-[#bdbdbd]"
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <span />
                    )}

                    <button
                        type="button"
                        onClick={addToBag}
                        className="inline-flex items-center gap-2 rounded-md bg-[#1a1a1a] px-5 py-2.5 text-[11px] font-medium text-white transition-colors hover:bg-black"
                    >
                        <ShoppingBagIcon className="h-3.5 w-3.5" strokeWidth={1.6} />
                        Add to Cart
                    </button>
                </div>
            </div>
        </article>
    );
}
