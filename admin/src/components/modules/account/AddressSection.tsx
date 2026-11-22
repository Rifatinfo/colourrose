"use client";

import { useState } from "react";
import { HomeIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { Toast } from "@/components/shared/Toast/Toast";
import {
    createAddress,
    deleteAddress,
    setDefaultAddress,
    updateAddress,
    useAddresses,
    type AddressDraft,
    type CustomerAddress,
} from "@/services/account/address";
import { Combobox } from "@/components/modules/addToCart/Combobox";
import {
    districtsForDivision,
    divisionForDistrict,
    divisionNames,
    postcodesByDistrict,
    postcodesForDistrict,
} from "@/components/modules/addToCart/data/bangladesh";
import { AccountCard, FieldValue } from "./AccountCard";

const emptyDraft: AddressDraft = {
    label: "Home",
    country: "Bangladesh",
    division: "",
    district: "",
    postalCode: "",
    addressLine: "",
    addressLine2: "",
};

const labelClass = "block text-[12px] text-[#1a1a1a]";
const inputClass =
    "mt-2 h-[34px] w-full rounded-md border border-[#dcdcdc] px-3 text-[12px] text-[#1a1a1a] outline-none placeholder:text-[#bdbdbd] focus:border-[#1a1a1a]";

/** The same red asterisk checkout marks its required fields with. */
function Required() {
    return (
        <span aria-hidden="true" className="text-[#e0322b]">
            {" "}
            *
        </span>
    );
}

export function AddressSection() {
    const addresses = useAddresses();

    /** `null` when closed, "new" when adding, otherwise the id being edited. */
    const [editing, setEditing] = useState<string | null>(null);
    const [draft, setDraft] = useState<AddressDraft>(emptyDraft);
    const [error, setError] = useState("");

    const openNew = () => {
        setDraft(emptyDraft);
        setError("");
        setEditing("new");
    };

    const openEdit = (address: CustomerAddress) => {
        setDraft({
            label: address.label,
            country: address.country,
            division: address.division,
            district: address.district,
            postalCode: address.postalCode,
            addressLine: address.addressLine,
            addressLine2: address.addressLine2 ?? "",
        });
        setError("");
        setEditing(address.id);
    };

    const close = () => {
        setEditing(null);
        setError("");
    };

    const save = () => {
        if (!draft.label.trim()) {
            setError("Give this address a name, such as Home or Office.");
            return;
        }
        if (!draft.addressLine.trim()) {
            setError("Address line is required.");
            return;
        }
        // Matches what checkout insists on, so an address saved here is always
        // complete enough to place an order with.
        if (!draft.division.trim()) {
            setError("Please choose a division.");
            return;
        }
        if (!draft.district.trim()) {
            setError("Please choose a district or city.");
            return;
        }

        if (editing === "new") {
            createAddress(draft);
            Toast.fire({ icon: "success", title: "Address added." });
        } else if (editing) {
            updateAddress(editing, draft);
            Toast.fire({ icon: "success", title: "Address updated." });
        }
        close();
    };

    const remove = (address: CustomerAddress) => {
        deleteAddress(address.id);
        if (editing === address.id) close();
        Toast.fire({ icon: "success", title: `${address.label} address removed.` });
    };

    const set = (patch: Partial<AddressDraft>) =>
        setDraft((current) => ({ ...current, ...patch }));

    /**
     * The three location fields answer to each other, the same way they do at
     * checkout.
     *
     * Changing the division abandons a district that no longer belongs to it,
     * rather than leaving a pair that cannot both be true.
     */
    const changeDivision = (next: string) =>
        setDraft((current) =>
            current.district && divisionForDistrict(current.district) !== next
                ? { ...current, division: next, district: "", postalCode: "" }
                : { ...current, division: next },
        );

    /**
     * Picking a district fills the division in for you — every district
     * belongs to exactly one, so asking twice is asking for a contradiction.
     * A district with a single postcode fills that too, and one whose codes no
     * longer include what is typed clears it.
     */
    const changeDistrict = (next: string) =>
        setDraft((current) => {
            const parent = divisionForDistrict(next);
            const codes = postcodesByDistrict[next];

            let postalCode = current.postalCode;
            if (codes?.length === 1) postalCode = codes[0];
            else if (codes && !codes.includes(current.postalCode)) postalCode = "";

            return {
                ...current,
                district: next,
                division: parent ?? current.division,
                postalCode,
            };
        });

    return (
        <AccountCard
            title="Address Details"
            action={
                <button
                    type="button"
                    onClick={openNew}
                    className="shrink-0 rounded-md bg-[#1a1a1a] px-3 py-2 text-[11px] font-medium text-white transition-colors hover:bg-black"
                >
                    + Add New Address
                </button>
            }
        >
            {addresses.length === 0 && editing === null && (
                <p className="py-4 text-center text-[12px] text-[#8f8f8f]">
                    No addresses saved yet. Add one so checkout can fill itself in.
                </p>
            )}

            <div className="space-y-4">
                {addresses.map((address) =>
                    editing === address.id ? (
                        <AddressForm
                            key={address.id}
                            draft={draft}
                            error={error}
                            onChange={set}
                            onDivisionChange={changeDivision}
                            onDistrictChange={changeDistrict}
                            onCancel={close}
                            onSave={save}
                        />
                    ) : (
                        <article
                            key={address.id}
                            className="rounded-lg border border-[#ececec] px-4 py-4"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <HomeIcon
                                        className="h-4 w-4 text-[#4a4a4a]"
                                        strokeWidth={1.5}
                                    />
                                    <h3 className="text-[13px] font-medium text-[#1a1a1a]">
                                        {address.label}
                                    </h3>
                                    {address.isDefault ? (
                                        <span className="rounded bg-[#f3ece1] px-1.5 py-0.5 text-[9px] font-medium text-[#9a7b4f]">
                                            Default
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setDefaultAddress(address.id)}
                                            className="text-[10px] text-[#8f8f8f] underline-offset-2 transition-colors hover:text-[#1a1a1a] hover:underline"
                                        >
                                            Make default
                                        </button>
                                    )}
                                </div>

                                <div className="flex shrink-0 items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => openEdit(address)}
                                        className="flex items-center gap-1 text-[11px] text-[#4a4a4a] transition-colors hover:text-[#1a1a1a]"
                                    >
                                        <PencilIcon className="h-3 w-3" strokeWidth={1.6} />
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => remove(address)}
                                        className="flex items-center gap-1 text-[11px] text-[#4a4a4a] transition-colors hover:text-[#c0392b]"
                                    >
                                        <Trash2Icon className="h-3 w-3" strokeWidth={1.6} />
                                        Delete
                                    </button>
                                </div>
                            </div>

                            <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                                <FieldValue label="Country" value={address.country} />
                                <FieldValue label="Division" value={address.division} />
                                <FieldValue label="District" value={address.district} />
                                <FieldValue
                                    label="Zip / Postal Code"
                                    value={address.postalCode}
                                />
                                <div className="sm:col-span-2">
                                    {/* The two lines are one address, so they read
                                        as one value rather than two labelled rows. */}
                                    <FieldValue
                                        label="Address Line"
                                        value={[address.addressLine, address.addressLine2]
                                            .filter((line) => line?.trim())
                                            .join(", ")}
                                    />
                                </div>
                            </dl>
                        </article>
                    ),
                )}

                {editing === "new" && (
                    <AddressForm
                        draft={draft}
                        error={error}
                        onChange={set}
                        onDivisionChange={changeDivision}
                        onDistrictChange={changeDistrict}
                        onCancel={close}
                        onSave={save}
                    />
                )}
            </div>
        </AccountCard>
    );
}

function AddressForm({
    draft,
    error,
    onChange,
    onDivisionChange,
    onDistrictChange,
    onCancel,
    onSave,
}: {
    draft: AddressDraft;
    error: string;
    onChange: (patch: Partial<AddressDraft>) => void;
    /** Separate from `onChange` because these two also clear the fields below them. */
    onDivisionChange: (value: string) => void;
    onDistrictChange: (value: string) => void;
    onCancel: () => void;
    onSave: () => void;
}) {
    return (
        <form
            className="rounded-lg border border-[#d9d9d9] bg-[#fcfcfc] px-4 py-4"
            onSubmit={(event) => {
                event.preventDefault();
                onSave();
            }}
        >
            <div>
                <label htmlFor="address-label" className={labelClass}>
                    Address Name
                    <Required />
                </label>
                <input
                    id="address-label"
                    value={draft.label}
                    onChange={(event) => onChange({ label: event.target.value })}
                    placeholder="Home, Office…"
                    className={inputClass}
                />
            </div>

            <div className="mt-5">
                <label htmlFor="address-line-1" className={labelClass}>
                    Address Line
                    <Required />
                </label>
                <input
                    id="address-line-1"
                    value={draft.addressLine}
                    onChange={(event) => onChange({ addressLine: event.target.value })}
                    placeholder="House, road, block"
                    className={inputClass}
                />
                <input
                    id="address-line-2"
                    aria-label="Address line 2"
                    value={draft.addressLine2 ?? ""}
                    onChange={(event) => onChange({ addressLine2: event.target.value })}
                    placeholder="Area, landmark (optional)"
                    className={`${inputClass} mt-3`}
                />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                <div>
                    <label htmlFor="address-country" className={labelClass}>
                        Country
                    </label>
                    {/* Fixed, exactly as at checkout: the shop delivers to one
                        country, so this is a statement rather than a choice. */}
                    <input
                        id="address-country"
                        readOnly
                        value="Bangladesh"
                        aria-readonly="true"
                        className="mt-2 h-[34px] w-full cursor-default rounded-md border border-[#dcdcdc] bg-[#fafafa] px-3 text-[12px] text-[#8f8f8f] outline-none"
                    />
                </div>

                <div>
                    <label htmlFor="address-division" className={labelClass}>
                        Division / Province
                        <Required />
                    </label>
                    <Combobox
                        id="address-division"
                        value={draft.division}
                        onChange={onDivisionChange}
                        options={divisionNames}
                        placeholder="Type or select your division"
                        emptyMessage="No division matches"
                    />
                </div>

                <div>
                    <label htmlFor="address-district" className={labelClass}>
                        District / City
                        <Required />
                    </label>
                    <Combobox
                        id="address-district"
                        value={draft.district}
                        onChange={onDistrictChange}
                        options={districtsForDivision(draft.division)}
                        placeholder={
                            draft.division
                                ? `Type or select a district in ${draft.division}`
                                : "Type your district or city"
                        }
                        emptyMessage="No district matches"
                        disabled={!draft.division}
                        disabledHint="Select a division first"
                    />
                </div>

                <div>
                    <label htmlFor="address-zip" className={labelClass}>
                        Zip / Postal Code
                    </label>
                    <Combobox
                        id="address-zip"
                        value={draft.postalCode}
                        // Options read "1207 — Dhaka"; only the code is stored.
                        onChange={(next) =>
                            onChange({ postalCode: next.split("—")[0].trim() })
                        }
                        options={postcodesForDistrict(draft.district)}
                        placeholder={
                            draft.district
                                ? `Postal codes for ${draft.district}`
                                : "Put your zip/postal code"
                        }
                        emptyMessage="No matching code — you can still use what you typed"
                        allowCustom
                        inputMode="numeric"
                        maxLength={12}
                    />
                </div>
            </div>

            {error && <p className="mt-3 text-[11px] text-[#c0392b]">{error}</p>}

            <div className="mt-4 flex items-center gap-2">
                <button
                    type="submit"
                    className="rounded-md bg-[#1a1a1a] px-4 py-2 text-[11px] font-medium text-white transition-colors hover:bg-black"
                >
                    Save Address
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-md border border-[#e0e0e0] px-4 py-2 text-[11px] text-[#4a4a4a] transition-colors hover:bg-[#f5f5f5]"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
