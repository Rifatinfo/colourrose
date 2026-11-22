"use client";

import { useEffect, useMemo, useState } from "react";
import {
    AlertTriangleIcon,
    Loader2Icon,
    PlusIcon,
    SearchIcon,
    Trash2Icon,
    XIcon,
} from "lucide-react";

import type { Product, ProductVariant } from "@/types/product";
import { formatBdt } from "@/utils/format";
import { Combobox } from "@/components/modules/addToCart/Combobox";
import {
    districtsForDivision,
    divisionForDistrict,
    divisionNames,
    postcodesByDistrict,
    postcodesForDistrict,
} from "@/components/modules/addToCart/data/bangladesh";
import { searchProductsForOrder } from "@/services/product/adminProductSearch";
import { validateCoupon } from "@/services/coupon/coupon";
import {
    createOrderForCustomer,
    markOrderCollected,
    updateOrderStatus,
    type CartItemDTO,
} from "@/services/order/order";

/**
 * Delivery zones, with the charges the server applies.
 *
 * Mirrored from `config/delivery.config.ts` so the total shown while building
 * the order matches the one that comes back. The server is still the
 * authority — it looks the charge up again from the zone name.
 */
const DELIVERY_ZONES = [
    { id: "DHAKA_CITY", label: "Inside Dhaka", charge: 60 },
    { id: "DHAKA_SUBURB", label: "Dhaka Suburb", charge: 100 },
    { id: "OUTSIDE_DHAKA", label: "Outside Dhaka", charge: 130 },
] as const;

type Line = {
    /** Unique per row so two sizes of one product stay separate. */
    key: string;
    productId: string;
    name: string;
    price: number;
    color: string;
    size: string;
    quantity: number;
    /** Stock on the chosen variant, so the row can warn before the server does. */
    available: number;
    /**
     * The product's other variants, kept on the row so the colour and size can
     * be changed without searching again — a phone order is usually "the black
     * one, size L", not whichever variant happened to be in stock first.
     */
    variants: ProductVariant[];
};

/** How a variant is identified in the row's select. */
const variantKey = (variant: ProductVariant) =>
    `${variant.color ?? ""}|${variant.size ?? ""}`;

const variantLabel = (variant: ProductVariant) => {
    const parts = [variant.color, variant.size].filter(Boolean).join(" · ");
    const name = parts || "Single variant";
    return variant.quantity > 0
        ? `${name} — ${variant.quantity} in stock`
        : `${name} — out of stock`;
};

const labelClass = "block text-xs font-medium text-ink";
const inputClass =
    "mt-1.5 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-slate-400";

function Required() {
    return (
        <span aria-hidden="true" className="text-rose-500">
            {" "}
            *
        </span>
    );
}

export function AddOrderDialog({
    onClose,
    onPlaced,
}: {
    onClose: () => void;
    /** Fired after a successful save so the list behind can reload. */
    onPlaced: (orderNo: string) => void;
}) {
    // ---- customer
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [addressLine, setAddressLine] = useState("");
    const [division, setDivision] = useState("");
    const [district, setDistrict] = useState("");
    const [zip, setZip] = useState("");
    const [note, setNote] = useState("");

    // ---- items
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Product[]>([]);
    const [searching, setSearching] = useState(false);
    const [lines, setLines] = useState<Line[]>([]);

    // ---- money
    const [zone, setZone] = useState<string>(DELIVERY_ZONES[0].id);
    const [paymentMethod, setPaymentMethod] = useState<"COD" | "ONLINE">("COD");
    const [couponCode, setCouponCode] = useState("");
    const [couponState, setCouponState] = useState<{
        status: "idle" | "checking" | "valid" | "invalid";
        discount: number;
        message: string;
    }>({ status: "idle", discount: 0, message: "" });
    const [markPaid, setMarkPaid] = useState(false);
    const [confirmNow, setConfirmNow] = useState(false);

    // ---- submission
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    /**
     * Set once the order exists.
     *
     * An ONLINE order makes the server open a payment session and hand back a
     * gateway URL. Nobody is standing at that gateway — the customer is on the
     * phone — so the link has to reach them, and closing the dialog on success
     * would throw away the only copy of it. When there is one, the dialog stays
     * up to hand it over.
     */
    const [placed, setPlaced] = useState<{
        orderNo: string;
        paymentUrl?: string;
    } | null>(null);
    const [copied, setCopied] = useState(false);

    const subtotal = useMemo(
        () => lines.reduce((sum, line) => sum + line.price * line.quantity, 0),
        [lines],
    );
    const deliveryCharge =
        DELIVERY_ZONES.find((option) => option.id === zone)?.charge ?? 0;
    const discount = couponState.status === "valid" ? couponState.discount : 0;
    const total = Math.max(subtotal - discount, 0) + deliveryCharge;

    // Close on Escape, as the other dialogs here do.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    /**
     * Debounced product lookup; each keystroke cancels the request before it.
     *
     * A query too short to search simply does not run one. What is on screen
     * is derived below rather than cleared from in here, so the effect never
     * writes state on its way past — the results of the last real search stay
     * in place, hidden, and come straight back if the letter is retyped.
     */
    const trimmedQuery = query.trim();
    const visibleResults = trimmedQuery.length >= 2 ? results : [];

    useEffect(() => {
        if (trimmedQuery.length < 2) return;

        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setSearching(true);
            searchProductsForOrder(trimmedQuery, controller.signal)
                .then(setResults)
                .finally(() => setSearching(false));
        }, 250);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [trimmedQuery]);

    /**
     * A coupon is the only discount the create endpoint accepts, and it
     * re-validates server-side against the subtotal — so this checks the same
     * way rather than letting the save fail with the reason hidden.
     */
    const checkCoupon = async () => {
        const code = couponCode.trim();
        if (!code) {
            setCouponState({ status: "idle", discount: 0, message: "" });
            return;
        }
        if (subtotal <= 0) {
            setCouponState({
                status: "invalid",
                discount: 0,
                message: "Add items before applying a coupon.",
            });
            return;
        }

        setCouponState({ status: "checking", discount: 0, message: "" });
        try {
            const result = await validateCoupon(code, subtotal);
            setCouponState({
                status: "valid",
                discount: result.discountAmount,
                message: `−${formatBdt(result.discountAmount)} applied`,
            });
        } catch (err: unknown) {
            setCouponState({
                status: "invalid",
                discount: 0,
                message: err instanceof Error ? err.message : "Coupon is not valid.",
            });
        }
    };

    const addLine = (product: Product) => {
        // Only variants with stock can be ordered — the server rejects the rest,
        // so they are not offered.
        const variant = (product.variants ?? []).find((item) => item.quantity > 0);
        if (!variant) {
            setError(`${product.name} has no variant in stock.`);
            return;
        }

        const color = variant.color ?? "";
        const size = variant.size ?? "";
        const key = `${product.id}-${color}-${size}`;
        if (lines.some((line) => line.key === key)) return;

        setError("");
        setLines((current) => [
            ...current,
            {
                key,
                productId: product.id,
                name: product.name,
                price: product.salePrice ?? product.regularPrice,
                color,
                size,
                quantity: 1,
                available: variant.quantity,
                variants: product.variants ?? [],
            },
        ]);
        setQuery("");
        setResults([]);
    };

    /**
     * Re-points a row at another variant of the same product.
     *
     * The row keeps its own identity key in step, so switching to a variant
     * that is already on the order does not create a duplicate the server
     * would price twice.
     */
    const changeVariant = (key: string, next: string) =>
        setLines((current) => {
            const line = current.find((row) => row.key === key);
            if (!line) return current;

            const variant = line.variants.find((item) => variantKey(item) === next);
            if (!variant) return current;

            const [color, size] = next.split("|");
            const nextKey = `${line.productId}-${color}-${size}`;
            if (nextKey !== key && current.some((row) => row.key === nextKey)) {
                return current;
            }

            return current.map((row) =>
                row.key === key
                    ? {
                          ...row,
                          key: nextKey,
                          color,
                          size,
                          available: variant.quantity,
                          quantity: Math.min(row.quantity, Math.max(variant.quantity, 1)),
                      }
                    : row,
            );
        });

    const setQuantity = (key: string, quantity: number) =>
        setLines((current) =>
            current.map((line) =>
                line.key === key
                    ? { ...line, quantity: Math.max(1, Math.min(quantity, line.available)) }
                    : line,
            ),
        );

    const removeLine = (key: string) =>
        setLines((current) => current.filter((line) => line.key !== key));

    const changeDivision = (next: string) => {
        setDivision(next);
        if (district && divisionForDistrict(district) !== next) {
            setDistrict("");
            setZip("");
        }
    };

    const changeDistrict = (next: string) => {
        setDistrict(next);
        const parent = divisionForDistrict(next);
        if (parent && parent !== division) setDivision(parent);
        const codes = postcodesByDistrict[next];
        if (codes?.length === 1) setZip(codes[0]);
        else if (codes && !codes.includes(zip)) setZip("");
    };

    const submit = async () => {
        if (!name.trim() || !phone.trim()) {
            setError("Customer name and phone are required.");
            return;
        }
        if (!addressLine.trim() || !district) {
            setError("A delivery address and district are required.");
            return;
        }
        if (lines.length === 0) {
            setError("Add at least one product.");
            return;
        }

        setError("");
        setSaving(true);

        const cartItems: CartItemDTO[] = lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            color: line.color,
            size: line.size,
        }));

        try {
            const response = await createOrderForCustomer({
                deliveryInfo: {
                    name: name.trim(),
                    phone: phone.trim(),
                    state: division,
                    address: [addressLine.trim(), district, zip]
                        .filter(Boolean)
                        .join(", "),
                },
                deliveryType: zone,
                cartItems,
                paymentMethod,
                ...(email.trim() && { checkoutEmail: email.trim() }),
                ...(couponState.status === "valid" && {
                    couponCode: couponCode.trim(),
                }),
            });

            const order = response?.data?.order;
            const orderId: string | undefined = order?.id;
            const orderNo: string = order?.orderNo ?? "";

            /**
             * The endpoint always writes PLACED / UNPAID — it takes no status
             * from the request. So the two adjustments a staff order usually
             * needs are applied straight after, through the admin routes that
             * do accept them. They are reported separately: the order exists
             * either way, and saying it failed because a follow-up did would
             * invite someone to place it twice.
             */
            const followUpFailures: string[] = [];
            if (orderId && markPaid) {
                try {
                    await markOrderCollected(orderId);
                } catch {
                    followUpFailures.push("mark it paid");
                }
            }
            if (orderId && confirmNow) {
                try {
                    await updateOrderStatus(orderId, "CONFIRMED");
                } catch {
                    followUpFailures.push("confirm it");
                }
            }

            setSaving(false);
            onPlaced(
                followUpFailures.length > 0
                    ? `Order ${orderNo} placed, but could not ${followUpFailures.join(" or ")} — do it from the row.`
                    : `Order ${orderNo} placed`,
            );

            const paymentUrl: string | undefined = response?.data?.paymentUrl;
            if (paymentUrl) {
                setPlaced({ orderNo, paymentUrl });
                return;
            }
            onClose();
        } catch (err: unknown) {
            setSaving(false);
            setError(
                err instanceof Error ? err.message : "Could not place the order.",
            );
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Add order"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-surface shadow-pop ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
                    <div>
                        <h2 className="text-lg font-bold tracking-tight text-ink">
                            Add order
                        </h2>
                        <p className="mt-0.5 text-xs text-ink-soft">
                            Place an order for a customer who ordered by phone or message.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-lg p-2 text-ink-soft transition-colors hover:bg-slate-100 hover:text-ink"
                    >
                        <XIcon className="h-4 w-4" />
                    </button>
                </div>

                {placed?.paymentUrl ? (
                    <div className="px-5 py-6 sm:px-6">
                        <p className="text-sm font-semibold text-ink">
                            Order {placed.orderNo} placed.
                        </p>
                        <p className="mt-1 text-xs text-ink-soft">
                            It was set to pay online, so the gateway opened a session for
                            it. Send this link to the customer — the order stays unpaid
                            until they finish there.
                        </p>

                        <div className="mt-3 flex gap-2">
                            <input
                                readOnly
                                value={placed.paymentUrl}
                                aria-label="Payment link"
                                onFocus={(event) => event.currentTarget.select()}
                                className={`${inputClass} mt-0 flex-1 font-mono text-xs`}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    void navigator.clipboard
                                        ?.writeText(placed.paymentUrl ?? "")
                                        .then(() => setCopied(true))
                                        // Clipboard access can be refused; the field is
                                        // selectable either way.
                                        .catch(() => setCopied(false));
                                }}
                                className="h-10 shrink-0 rounded-xl border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-slate-300"
                            >
                                {copied ? "Copied" : "Copy"}
                            </button>
                        </div>

                        <div className="mt-5 flex justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                className="h-10 rounded-xl bg-ink px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                ) : (
                <>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                    {/* ---------------- customer ---------------- */}
                    <section>
                        <h3 className="text-sm font-semibold text-ink">Customer</h3>
                        <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                            <div>
                                <label htmlFor="ao-name" className={labelClass}>
                                    Name
                                    <Required />
                                </label>
                                <input
                                    id="ao-name"
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label htmlFor="ao-phone" className={labelClass}>
                                    Phone
                                    <Required />
                                </label>
                                <input
                                    id="ao-phone"
                                    value={phone}
                                    onChange={(event) => setPhone(event.target.value)}
                                    inputMode="tel"
                                    placeholder="01XXXXXXXXX"
                                    className={inputClass}
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label htmlFor="ao-email" className={labelClass}>
                                    Email
                                </label>
                                <input
                                    id="ao-email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    type="email"
                                    placeholder="Where the confirmation is sent"
                                    className={inputClass}
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label htmlFor="ao-address" className={labelClass}>
                                    Address line
                                    <Required />
                                </label>
                                <input
                                    id="ao-address"
                                    value={addressLine}
                                    onChange={(event) => setAddressLine(event.target.value)}
                                    placeholder="House, road, block, area"
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label htmlFor="ao-division" className={labelClass}>
                                    Division / Province
                                </label>
                                <Combobox
                                    id="ao-division"
                                    value={division}
                                    onChange={changeDivision}
                                    options={divisionNames}
                                    placeholder="Type or select a division"
                                    emptyMessage="No division matches"
                                />
                            </div>
                            <div>
                                <label htmlFor="ao-district" className={labelClass}>
                                    District / City
                                    <Required />
                                </label>
                                <Combobox
                                    id="ao-district"
                                    value={district}
                                    onChange={changeDistrict}
                                    options={districtsForDivision(division)}
                                    placeholder={
                                        division
                                            ? `Districts in ${division}`
                                            : "Type a district or city"
                                    }
                                    emptyMessage="No district matches"
                                />
                            </div>
                            <div>
                                <label htmlFor="ao-zip" className={labelClass}>
                                    Zip / Postal code
                                </label>
                                <Combobox
                                    id="ao-zip"
                                    value={zip}
                                    onChange={(next) => setZip(next.split("—")[0].trim())}
                                    options={postcodesForDistrict(district)}
                                    placeholder={
                                        district ? `Codes for ${district}` : "Postal code"
                                    }
                                    emptyMessage="No matching code — you can still type one"
                                    allowCustom
                                    inputMode="numeric"
                                    maxLength={12}
                                />
                            </div>
                            <div>
                                <label htmlFor="ao-note" className={labelClass}>
                                    Note
                                </label>
                                <input
                                    id="ao-note"
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                    placeholder="Anything the packer should know"
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </section>

                    {/* ---------------- items ---------------- */}
                    <section className="mt-7">
                        <h3 className="text-sm font-semibold text-ink">Items</h3>

                        <div className="relative mt-3">
                            <SearchIcon
                                aria-hidden="true"
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                            />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search products by name or SKU"
                                aria-label="Search products"
                                className={`${inputClass} mt-0 pl-9`}
                            />
                            {searching && (
                                <Loader2Icon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-muted" />
                            )}

                            {visibleResults.length > 0 && (
                                <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-pop">
                                    {visibleResults.map((product) => {
                                        const inStock = (product.variants ?? []).some(
                                            (variant) => variant.quantity > 0,
                                        );
                                        return (
                                            <li key={product.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => addLine(product)}
                                                    disabled={!inStock}
                                                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <span className="min-w-0 truncate text-ink">
                                                        {product.name}
                                                    </span>
                                                    <span className="shrink-0 text-xs text-ink-soft">
                                                        {inStock
                                                            ? formatBdt(
                                                                  product.salePrice ??
                                                                      product.regularPrice,
                                                              )
                                                            : "Out of stock"}
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {lines.length === 0 ? (
                            <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-6 text-center text-xs text-ink-muted">
                                No items yet. Search above to add the first one.
                            </p>
                        ) : (
                            <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
                                {lines.map((line) => (
                                    <li
                                        key={line.key}
                                        className="flex flex-wrap items-center gap-3 px-3 py-3"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm text-ink">{line.name}</p>
                                            <p className="mt-0.5 text-xs text-ink-soft">
                                                {formatBdt(line.price)} each
                                            </p>

                                            {line.variants.length > 1 ? (
                                                <select
                                                    value={`${line.color}|${line.size}`}
                                                    onChange={(event) =>
                                                        changeVariant(line.key, event.target.value)
                                                    }
                                                    aria-label={`Variant for ${line.name}`}
                                                    className="mt-1.5 h-8 w-full max-w-[240px] rounded-lg border border-line px-2 text-xs text-ink outline-none focus:border-slate-400"
                                                >
                                                    {line.variants.map((variant) => (
                                                        <option
                                                            key={variantKey(variant)}
                                                            value={variantKey(variant)}
                                                            disabled={variant.quantity <= 0}
                                                        >
                                                            {variantLabel(variant)}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <p className="mt-0.5 text-xs text-ink-muted">
                                                    {[line.color, line.size]
                                                        .filter(Boolean)
                                                        .join(" · ") || "Single variant"}{" "}
                                                    · {line.available} in stock
                                                </p>
                                            )}
                                        </div>

                                        <input
                                            type="number"
                                            min={1}
                                            max={line.available}
                                            value={line.quantity}
                                            onChange={(event) =>
                                                setQuantity(line.key, Number(event.target.value))
                                            }
                                            aria-label={`Quantity for ${line.name}`}
                                            className="h-9 w-16 rounded-lg border border-line px-2 text-center text-sm text-ink outline-none focus:border-slate-400"
                                        />

                                        <span className="w-20 shrink-0 text-right text-sm font-medium text-ink">
                                            {formatBdt(line.price * line.quantity)}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() => removeLine(line.key)}
                                            aria-label={`Remove ${line.name}`}
                                            className="rounded-lg p-2 text-ink-soft transition-colors hover:bg-rose-50 hover:text-rose-600"
                                        >
                                            <Trash2Icon className="h-4 w-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* ---------------- payment ---------------- */}
                    <section className="mt-7">
                        <h3 className="text-sm font-semibold text-ink">
                            Delivery &amp; payment
                        </h3>

                        <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                            <div>
                                <label htmlFor="ao-zone" className={labelClass}>
                                    Delivery zone
                                </label>
                                <select
                                    id="ao-zone"
                                    value={zone}
                                    onChange={(event) => setZone(event.target.value)}
                                    className={inputClass}
                                >
                                    {DELIVERY_ZONES.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.label} — {formatBdt(option.charge)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="ao-method" className={labelClass}>
                                    Payment method
                                </label>
                                <select
                                    id="ao-method"
                                    value={paymentMethod}
                                    onChange={(event) =>
                                        setPaymentMethod(event.target.value as "COD" | "ONLINE")
                                    }
                                    className={inputClass}
                                >
                                    <option value="COD">Cash on Delivery</option>
                                    <option value="ONLINE">Online</option>
                                </select>
                            </div>

                            <div className="sm:col-span-2">
                                <label htmlFor="ao-coupon" className={labelClass}>
                                    Discount coupon
                                </label>
                                <div className="mt-1.5 flex gap-2">
                                    <input
                                        id="ao-coupon"
                                        value={couponCode}
                                        onChange={(event) => {
                                            setCouponCode(event.target.value);
                                            setCouponState({
                                                status: "idle",
                                                discount: 0,
                                                message: "",
                                            });
                                        }}
                                        placeholder="Code"
                                        className={`${inputClass} mt-0 flex-1`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => void checkCoupon()}
                                        disabled={couponState.status === "checking"}
                                        className="h-10 shrink-0 rounded-xl border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-slate-300 disabled:opacity-60"
                                    >
                                        {couponState.status === "checking" ? "Checking…" : "Apply"}
                                    </button>
                                </div>
                                {couponState.message && (
                                    <p
                                        className={`mt-1.5 text-xs ${
                                            couponState.status === "valid"
                                                ? "text-emerald-600"
                                                : "text-rose-600"
                                        }`}
                                    >
                                        {couponState.message}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-line bg-slate-50/60 px-4 py-3 text-sm">
                            <Row label="Subtotal" value={formatBdt(subtotal)} />
                            {discount > 0 && (
                                <Row label="Discount" value={`− ${formatBdt(discount)}`} />
                            )}
                            <Row label="Delivery" value={formatBdt(deliveryCharge)} />
                            <div className="mt-2 flex items-center justify-between border-t border-line pt-2 font-semibold text-ink">
                                <span>Total</span>
                                <span>{formatBdt(total)}</span>
                            </div>
                        </div>

                        <div className="mt-3 space-y-2">
                            <label className="flex items-center gap-2 text-sm text-ink">
                                <input
                                    type="checkbox"
                                    checked={markPaid}
                                    onChange={(event) => setMarkPaid(event.target.checked)}
                                    className="h-4 w-4 rounded border-line"
                                />
                                Payment already collected — mark this order paid
                            </label>
                            <label className="flex items-center gap-2 text-sm text-ink">
                                <input
                                    type="checkbox"
                                    checked={confirmNow}
                                    onChange={(event) => setConfirmNow(event.target.checked)}
                                    className="h-4 w-4 rounded border-line"
                                />
                                Confirm it straight away, ready to pack
                            </label>
                            <p className="flex items-start gap-1.5 text-xs text-ink-muted">
                                <AlertTriangleIcon
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                    aria-hidden="true"
                                />
                                Prices come from the product record and the discount from the
                                coupon — neither can be typed in here.
                            </p>
                        </div>
                    </section>

                    {error && (
                        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="h-10 rounded-xl border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-slate-300 disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => void submit()}
                        disabled={saving}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                        {saving ? (
                            <Loader2Icon className="h-4 w-4 animate-spin" />
                        ) : (
                            <PlusIcon className="h-4 w-4" />
                        )}
                        {saving ? "Placing…" : "Place order"}
                    </button>
                </div>
                </>
                )}
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-0.5 text-ink-soft">
            <span>{label}</span>
            <span className="text-ink">{value}</span>
        </div>
    );
}
