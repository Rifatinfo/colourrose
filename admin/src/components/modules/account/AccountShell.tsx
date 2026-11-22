"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    createContext,
    useContext,
    useTransition,
    type ReactNode,
} from "react";
import { ChevronDownIcon, LogOutIcon } from "lucide-react";

import type { UserInfo } from "@/types/user.interface";
import { logout } from "@/services/auth/logoutUser";
import { accountNavItems, isAccountNavItemActive } from "./accountNav";
import { AccountProfileCard } from "./AccountProfileCard";

/**
 * Who is signed in, for the pieces of the account area that need it but are
 * rendered by pages rather than by the shell.
 *
 * The pages are server components — they cannot hand `user` to a client child
 * without serialising it through every one of them, and the phone header is
 * the only thing that needs it. A context puts it one import away instead.
 */
const AccountUserContext = createContext<UserInfo | null>(null);

const useAccountUser = (): UserInfo | null => useContext(AccountUserContext);

/**
 * The frame every account page is rendered into: identity and menu on the
 * left, the page itself on the right.
 *
 * The menu is one list rendered two ways rather than two lists — a column on
 * desktop, a select on phones — which is what keeps a seven-item menu from
 * pushing the page content below the fold on a handset.
 */
export function AccountShell({
    user,
    children,
}: {
    user: UserInfo;
    children: ReactNode;
}) {
    const pathname = usePathname();
    const [signingOut, startSignOut] = useTransition();

    const signOut = () => startSignOut(() => void logout());

    return (
        <AccountUserContext.Provider value={user}>
            <div className="w-full bg-white font-dm-sans">
                <div className="mx-auto w-full max-w-[1440px] px-5 pb-16 pt-20 sm:px-8 lg:px-14 lg:pb-24 lg:pt-26">
                    <div className="lg:flex lg:gap-10">
                        <aside className="hidden w-[230px] shrink-0 lg:block">
                            <AccountProfileCard user={user} />

                            <nav aria-label="Account" className="mt-6">
                                <ul className="space-y-0.5">
                                    {accountNavItems.map((item) => {
                                        const active = isAccountNavItemActive(
                                            item.href,
                                            pathname,
                                        );
                                        const Icon = item.icon;
                                        return (
                                            <li key={item.href}>
                                                <Link
                                                    href={item.href}
                                                    aria-current={active ? "page" : undefined}
                                                    className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[12px] transition-colors ${
                                                        active
                                                            ? "bg-[#f3f3f3] font-medium text-[#1a1a1a]"
                                                            : "text-[#5f5f5f] hover:bg-[#f7f7f7] hover:text-[#1a1a1a]"
                                                    }`}
                                                >
                                                    <Icon
                                                        className="h-[15px] w-[15px] shrink-0"
                                                        strokeWidth={1.5}
                                                    />
                                                    {item.label}
                                                </Link>
                                            </li>
                                        );
                                    })}

                                    <li>
                                        <button
                                            type="button"
                                            onClick={signOut}
                                            disabled={signingOut}
                                            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-[12px] text-[#5f5f5f] transition-colors hover:bg-[#f7f7f7] hover:text-[#1a1a1a] disabled:opacity-60"
                                        >
                                            <LogOutIcon
                                                className="h-[15px] w-[15px] shrink-0"
                                                strokeWidth={1.5}
                                            />
                                            {signingOut ? "Signing out…" : "Sign Out"}
                                        </button>
                                    </li>
                                </ul>
                            </nav>
                        </aside>

                        <div className="min-w-0 flex-1">{children}</div>
                    </div>
                </div>
            </div>
        </AccountUserContext.Provider>
    );
}

/**
 * Identity and menu on a phone, where the left column does not exist.
 *
 * Placed by each page rather than by the shell because the design puts it
 * below that page's banner: the banner is the first thing on a handset, not
 * the menu.
 */
export function AccountMobileHeader() {
    const user = useAccountUser();

    return (
        <div className="lg:hidden">
            {user && (
                <div className="mt-8">
                    <AccountProfileCard user={user} />
                </div>
            )}
            <AccountMobileNav />
        </div>
    );
}

/**
 * A native `select` rather than a custom menu: this is a jump list of seven
 * links, and the platform control gets keyboard, screen-reader and one-handed
 * use right without any of it being rebuilt.
 */
function AccountMobileNav() {
    const pathname = usePathname();
    const router = useRouter();

    const current =
        accountNavItems.find((item) => isAccountNavItemActive(item.href, pathname))
            ?.href ?? accountNavItems[0].href;

    return (
        <div className="relative mt-6">
            <label className="sr-only" htmlFor="account-section">
                Account section
            </label>
            <select
                id="account-section"
                value={current}
                onChange={(event) => router.push(event.target.value)}
                className="w-full appearance-none rounded-md border border-[#e0e0e0] bg-white px-4 py-3 text-[13px] text-[#1a1a1a] outline-none focus-visible:border-[#1a1a1a]"
            >
                {accountNavItems.map((item) => (
                    <option key={item.href} value={item.href}>
                        {item.label}
                    </option>
                ))}
            </select>
            <ChevronDownIcon
                aria-hidden="true"
                className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f6f6f]"
                strokeWidth={1.5}
            />
        </div>
    );
}
