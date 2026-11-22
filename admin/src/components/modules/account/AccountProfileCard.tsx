"use client";

import Link from "next/link";
import { CameraIcon } from "lucide-react";

import type { UserInfo } from "@/types/user.interface";
import { getUserAvatar } from "@/utiles/user-utils";
import { useAddresses } from "@/services/account/address";
import {
    customerReference,
    profileCompletion,
    useProfileDetails,
} from "@/services/account/profileDetails";

/**
 * The identity block at the top of the account menu: who is signed in, their
 * membership number, and how far through the profile they are.
 */
export function AccountProfileCard({ user }: { user: UserInfo }) {
    const details = useProfileDetails();
    const addresses = useAddresses();

    const avatar = getUserAvatar(user);
    const phone = details?.phone ?? "";
    const completion = profileCompletion({
        name: user.name,
        email: user.email,
        avatar,
        details,
        addressCount: addresses.length,
    });

    return (
        <div className="font-dm-sans">
            <div className="flex flex-col items-center text-center">
                <div className="relative">
                    <span className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full bg-[#e4e4e4] text-[22px] text-[#8f8f8f]">
                        {avatar ? (
                            // A plain img: avatars come from the uploads host as
                            // arbitrary paths, and this one is 76px either way.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={avatar}
                                alt=""
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            (user.name ?? "?").trim().charAt(0).toUpperCase()
                        )}
                    </span>

                    {/* Goes to the form rather than opening a file picker here:
                        the picker lives on the profile page with the preview
                        and the save button that commits it. */}
                    <Link
                        href="/account/profile"
                        aria-label="Change profile photo"
                        className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border border-[#e0e0e0] bg-white text-[#4a4a4a] transition-colors hover:bg-[#f5f5f5]"
                    >
                        <CameraIcon className="h-3 w-3" strokeWidth={1.6} />
                    </Link>
                </div>

                <p className="mt-3 text-[13px] font-medium text-[#1a1a1a]">
                    {user.name}
                </p>
                <p className="mt-0.5 text-[11px] text-[#8f8f8f]">
                    {customerReference(user.id)}
                </p>
                <p className="mt-0.5 break-all text-[11px] text-[#8f8f8f]">
                    {user.email}
                </p>
                {phone && (
                    <p className="mt-0.5 text-[11px] text-[#8f8f8f]">{phone}</p>
                )}
            </div>

            <div className="mt-5 rounded-md bg-[#f4f4f4] px-3 py-3">
                <div className="flex items-center justify-between text-[10px] text-[#6f6f6f]">
                    <span>Profile Completion</span>
                    <span className="font-medium text-[#1a1a1a]">{completion}%</span>
                </div>
                <div
                    className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[#dcdcdc]"
                    role="progressbar"
                    aria-valuenow={completion}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Profile completion"
                >
                    <span
                        className="block h-full rounded-full bg-[#1a1a1a] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                        style={{ width: `${completion}%` }}
                    />
                </div>
                <p className="mt-2 text-[9px] leading-relaxed text-[#8f8f8f]">
                    Complete your profile for a better experience
                </p>
            </div>
        </div>
    );
}
