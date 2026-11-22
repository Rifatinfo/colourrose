import {
    HeartIcon,
    HistoryIcon,
    type LucideIcon,
    PackageSearchIcon,
    ShoppingCartIcon,
    StarIcon,
    UserRoundIcon,
} from "lucide-react";

export type AccountNavItem = {
    label: string;
    href: string;
    icon: LucideIcon;
};

/**
 * The customer account menu, in the order it is shown.
 *
 * One list, three places: the sidebar on desktop, the select on phones, and
 * the account block in the site drawer. They used to be written out separately,
 * which is how the drawer ended up with labels that pointed nowhere — a link
 * added here now appears in all three, already routed.
 *
 * Shopping Cart is the odd one out: it leaves the account area for the bag
 * that already exists at /shoppingBag rather than duplicating it here. It
 * stays in the list because customers look for it in this menu.
 */
export const accountNavItems: readonly AccountNavItem[] = [
    { label: "My Profile", href: "/account/profile", icon: UserRoundIcon },
    { label: "Shopping Cart", href: "/shoppingBag", icon: ShoppingCartIcon },
    { label: "Purchase History", href: "/account/orders", icon: HistoryIcon },
    { label: "Track Order", href: "/account/track", icon: PackageSearchIcon },
    { label: "My Wishlist", href: "/account/wishlist", icon: HeartIcon },
    { label: "My Reviews", href: "/account/reviews", icon: StarIcon },
];

/**
 * Whether a nav row should read as the current page.
 *
 * Prefix rather than equality so a detail view under a section keeps its
 * parent lit, but anchored at a segment boundary: without that check
 * "/account/order" would also light "/account/orders".
 */
export const isAccountNavItemActive = (href: string, pathname: string): boolean =>
    pathname === href || pathname.startsWith(`${href}/`);
