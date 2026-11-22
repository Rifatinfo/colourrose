"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraIcon, PencilIcon } from "lucide-react";

import type { UserInfo } from "@/types/user.interface";
import { getUserAvatar } from "@/utiles/user-utils";
import { Toast } from "@/components/shared/Toast/Toast";
import { updateMyProfile } from "@/services/user/profile";
import {
    emptyProfileDetails,
    joinName,
    saveProfileDetails,
    splitName,
    useProfileDetails,
    type ProfileDetails,
} from "@/services/account/profileDetails";
import { AccountCard, FieldValue } from "./AccountCard";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB

const inputClass =
    "mt-1 w-full rounded-md border border-[#e0e0e0] px-3 py-2 text-[13px] text-[#1a1a1a] outline-none transition-colors focus-visible:border-[#1a1a1a]";

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];

/**
 * The customer's own details.
 *
 * Two destinations behind one Save. The name and photo go to
 * `PATCH /user/me`, which is the only part of this form the server can hold
 * for a customer; the rest is kept in the browser until the columns exist.
 * The customer is not shown that seam — one form, one button — but a failed
 * write to the real endpoint stops the whole save rather than half-reporting
 * success.
 */
export function PersonalInfoSection({ user }: { user: UserInfo }) {
    const router = useRouter();
    const stored = useProfileDetails();

    const savedAvatar = getUserAvatar(user);
    const nameHalves = splitName(user.name ?? "");

    /**
     * What the form shows when it opens: whatever is stored, falling back to
     * the halves of the name the server holds. Without the fallback a
     * customer who has never opened this form would see First and Last empty
     * while their name is plainly on the page above.
     */
    const initial: ProfileDetails = {
        ...emptyProfileDetails,
        ...(stored ?? {}),
        firstName: stored?.firstName || nameHalves.firstName,
        lastName: stored?.lastName || nameHalves.lastName,
    };

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<ProfileDetails>(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // ---- photo
    const fileRef = useRef<HTMLInputElement>(null);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

    const openEditor = () => {
        setDraft(initial);
        setError("");
        setEditing(true);
    };

    const cancel = () => {
        setEditing(false);
        setError("");
        setPhotoFile(null);
        setPhotoPreview(null);
        if (fileRef.current) fileRef.current.value = "";
    };

    const pickPhoto = (file: File | undefined) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            Toast.fire({ icon: "error", title: "Please choose an image file." });
            return;
        }
        if (file.size > MAX_PHOTO_BYTES) {
            Toast.fire({ icon: "error", title: "Photo must be 2 MB or smaller." });
            return;
        }
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
    };

    const set = (patch: Partial<ProfileDetails>) =>
        setDraft((current) => ({ ...current, ...patch }));

    const save = async () => {
        const fullName = joinName(draft.firstName, draft.lastName);
        if (fullName.trim().length < 2) {
            setError("Please enter your name.");
            return;
        }

        setError("");
        setSaving(true);

        const formData = new FormData();
        formData.append("data", JSON.stringify({ name: fullName }));
        if (photoFile) formData.append("file", photoFile);

        const result = await updateMyProfile(formData);
        setSaving(false);

        if (!result.success) {
            setError(result.message);
            Toast.fire({ icon: "error", title: result.message });
            return;
        }

        saveProfileDetails(draft);
        setPhotoFile(null);
        setPhotoPreview(null);
        setEditing(false);
        Toast.fire({ icon: "success", title: "Profile updated." });

        // The layout reads the user on the server; the action has already
        // invalidated its cache tag, so a refresh is enough to bring the new
        // name and photo to the header and the sidebar without a full reload.
        router.refresh();
    };

    const shownAvatar = photoPreview ?? savedAvatar;

    return (
        <AccountCard
            title="Personal Information"
            action={
                !editing && (
                    <button
                        type="button"
                        onClick={openEditor}
                        className="flex shrink-0 items-center gap-1 text-[11px] text-[#4a4a4a] transition-colors hover:text-[#1a1a1a]"
                    >
                        <PencilIcon className="h-3 w-3" strokeWidth={1.6} />
                        Edit
                    </button>
                )
            }
        >
            {editing ? (
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        void save();
                    }}
                >
                    <div className="mb-5 flex items-center gap-4">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e4e4e4] text-[18px] text-[#8f8f8f]">
                            {shownAvatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={shownAvatar}
                                    alt=""
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                (user.name ?? "?").trim().charAt(0).toUpperCase()
                            )}
                        </span>
                        <div>
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="flex items-center gap-1.5 rounded-md border border-[#e0e0e0] px-3 py-2 text-[11px] text-[#4a4a4a] transition-colors hover:bg-[#f5f5f5]"
                            >
                                <CameraIcon className="h-3 w-3" strokeWidth={1.6} />
                                Change photo
                            </button>
                            <p className="mt-1.5 text-[10px] text-[#9a9a9a]">
                                JPG or PNG, up to 2 MB.
                            </p>
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(event) => pickPhoto(event.target.files?.[0])}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                        <label className="block">
                            <span className="text-[11px] text-[#9a9a9a]">First Name</span>
                            <input
                                value={draft.firstName}
                                onChange={(event) => set({ firstName: event.target.value })}
                                className={inputClass}
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] text-[#9a9a9a]">Last Name</span>
                            <input
                                value={draft.lastName}
                                onChange={(event) => set({ lastName: event.target.value })}
                                className={inputClass}
                            />
                        </label>

                        <label className="block">
                            <span className="text-[11px] text-[#9a9a9a]">Email</span>
                            <input
                                value={user.email ?? ""}
                                readOnly
                                // The sign-in identity. Changing it is an account
                                // operation with its own verification, not a field
                                // on a details form.
                                title="Email cannot be changed here"
                                className={`${inputClass} cursor-not-allowed bg-[#f7f7f7] text-[#8f8f8f]`}
                            />
                        </label>
                        <label className="block">
                            <span className="text-[11px] text-[#9a9a9a]">Phone Number</span>
                            <input
                                value={draft.phone}
                                onChange={(event) => set({ phone: event.target.value })}
                                inputMode="tel"
                                placeholder="+8801XXXXXXXXX"
                                className={inputClass}
                            />
                        </label>

                        <label className="block">
                            <span className="text-[11px] text-[#9a9a9a]">Gender</span>
                            <select
                                value={draft.gender}
                                onChange={(event) => set({ gender: event.target.value })}
                                className={inputClass}
                            >
                                <option value="">Select</option>
                                {GENDERS.map((gender) => (
                                    <option key={gender} value={gender}>
                                        {gender}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-[11px] text-[#9a9a9a]">Anniversary</span>
                            <input
                                type="date"
                                value={draft.anniversary}
                                onChange={(event) => set({ anniversary: event.target.value })}
                                className={inputClass}
                            />
                        </label>

                        <label className="block">
                            <span className="text-[11px] text-[#9a9a9a]">Date of Birth</span>
                            <input
                                type="date"
                                value={draft.dateOfBirth}
                                onChange={(event) => set({ dateOfBirth: event.target.value })}
                                className={inputClass}
                            />
                        </label>
                    </div>

                    {error && <p className="mt-3 text-[11px] text-[#c0392b]">{error}</p>}

                    <div className="mt-5 flex items-center gap-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-md bg-[#1a1a1a] px-4 py-2 text-[11px] font-medium text-white transition-colors hover:bg-black disabled:opacity-60"
                        >
                            {saving ? "Saving…" : "Save Changes"}
                        </button>
                        <button
                            type="button"
                            onClick={cancel}
                            disabled={saving}
                            className="rounded-md border border-[#e0e0e0] px-4 py-2 text-[11px] text-[#4a4a4a] transition-colors hover:bg-[#f5f5f5] disabled:opacity-60"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            ) : (
                <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                    <FieldValue label="First Name" value={initial.firstName} />
                    <FieldValue label="Last Name" value={initial.lastName} />
                    <FieldValue label="Email" value={user.email} />
                    <FieldValue label="Phone Number" value={initial.phone} />
                    <FieldValue label="Gender" value={initial.gender} />
                    <FieldValue label="Anniversary" value={initial.anniversary} />
                    <FieldValue label="Date of Birth" value={initial.dateOfBirth} />
                </dl>
            )}
        </AccountCard>
    );
}
