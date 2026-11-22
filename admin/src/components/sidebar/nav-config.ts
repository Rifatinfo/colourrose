import {
  LayoutDashboardIcon,
  ChartColumnIcon,
  WalletIcon,
  UsersIcon,
  HeadsetIcon,
  ShoppingBagIcon,
  WarehouseIcon,
  PackageIcon,
  BoxesIcon,
  PackagePlusIcon,
  TicketPercentIcon,
  ReceiptTextIcon,
  TagIcon,
  TruckIcon,
  MessagesSquareIcon,
  NewspaperIcon,
  MegaphoneIcon,
  ListTreeIcon,
  FolderTreeIcon,
  FileTextIcon,
  UserCogIcon,
  ShieldCheckIcon,
  HistoryIcon,
  KeyRoundIcon,
  SettingsIcon,
  CircleHelpIcon,
  type LucideIcon,
} from "lucide-react";
import { UserRole } from "@/types/role";

export type NavItem = {
  id: string;
  label: string;
  /** Lucide only, so every route shares one stroke, grid and style. */
  icon: LucideIcon;
  roles: UserRole[];
  path?: string;
  children?: NavItem[];
  /** Key into the live counts map; rendered as a badge on the right. */
  countKey?: "posts" | "ads";
};

// =====================
// Dashboard Section
// =====================
export const NAV_MAIN: NavItem[] = [
  {
    id: "overview",
    label: "Sales Overview",
    icon: LayoutDashboardIcon,
    roles: ["ADMIN", "SHOP_MANAGER", "MEDIA_MANAGER"],
    path: "/admin",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: ChartColumnIcon,
    roles: ["ADMIN"],
    path: "/admin/analytics",
  },
  {
    id: "finance",
    label: "Finance",
    icon: WalletIcon,
    roles: ["ADMIN"],
    path: "/admin/finance",
  },
  {
    id: "customer",
    label: "Customers",
    icon: UsersIcon,
    roles: ["ADMIN"],
    path: "/admin/customer",
  },
  {
    id: "support",
    label: "Support",
    icon: HeadsetIcon,
    roles: ["ADMIN"],
    path: "/admin/support",
  },
  {
    id: "orders",
    label: "Orders",
    icon: ShoppingBagIcon,
    roles: ["ADMIN"],
    path: "/admin/orders",
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: WarehouseIcon,
    roles: ["ADMIN"],
    path: "/admin/inventory-management",
  },
  {
  id: "products",
  label: "Products",
  icon: PackageIcon,
  roles: ["ADMIN"],
  path: "/admin/products",
  children: [
    {
      id: "all-product",
      label: "All Products",
      icon: BoxesIcon,
      roles: ["ADMIN"],
      path: "/admin/all-product",
    },
    {
      id: "add-product",
      label: "Add Product",
      icon: PackagePlusIcon,
      roles: ["ADMIN"],
      path: "/admin/add-product",
    },
    {
      id: "coupons",
      label: "Coupons",
      icon: TicketPercentIcon,
      roles: ["ADMIN"],
      path: "/admin/coupons",
    },
    {
      id: "invoices",
      label: "Invoices",
      icon: ReceiptTextIcon,
      roles: ["ADMIN"],
      path: "/admin/invoices",
    },
    {
      id: "pricing",
      label: "Pricing",
      icon: TagIcon,
      roles: ["ADMIN"],
      path: "/admin/pricing",
    },
    {
      id: "shipping",
      label: "Shipping",
      icon: TruckIcon,
      roles: ["ADMIN"],
      path: "/admin/shipping",
    },
  ],
},
{
    id: "comment",
    label: "Comment Box",
    icon: MessagesSquareIcon,
    roles: ["ADMIN"],
    path: "/admin/comment-box",
  },
  
];

// =====================
// More Section
// =====================
export const NAV_SECONDARY: NavItem[] = [
  {
    id: "settings",
    label: "Settings",
    icon: SettingsIcon,
    roles: ["ADMIN", "SHOP_MANAGER", "MEDIA_MANAGER"],
    path: "/admin/settings",
  },

  {
    id: "help-center",
    label: "Help Center",
    icon: CircleHelpIcon,
    roles: ["ADMIN", "SHOP_MANAGER", "MEDIA_MANAGER"],
    path: "/admin/search",
  },
];

// =====================
// Website Section
// =====================
/**
 * Where the storefront's own structure is managed: the navigation, the
 * product taxonomy behind it, and the pages it points at.
 *
 * Sits between Content and Administration because it is the shop's content,
 * not the dashboard's settings.
 */
export const NAV_WEBSITE: NavItem[] = [
  {
    id: "menu-navigation",
    label: "Menu & Navigation",
    icon: ListTreeIcon,
    roles: ["ADMIN", "MEDIA_MANAGER"],
    path: "/admin/menu-navigation",
  },
  {
    id: "website-categories",
    label: "Categories",
    icon: FolderTreeIcon,
    roles: ["ADMIN", "MEDIA_MANAGER"],
    path: "/admin/website-categories",
  },
  {
    id: "pages",
    label: "Pages",
    icon: FileTextIcon,
    roles: ["ADMIN", "MEDIA_MANAGER"],
    path: "/admin/pages",
  },
];

// =====================
// Administration Section
// =====================
/**
 * Replaces the old "Admin Role" group and Control Authority. Staff used to be
 * created through four near-identical "Add <role>" pages; Users & Access is
 * one roster over the same endpoints, and the roles, the audit trail and the
 * access policy each have a screen of their own beside it.
 */
export const NAV_ADMINISTRATION: NavItem[] = [
  {
    id: "users-access",
    label: "Users & Access",
    icon: UserCogIcon,
    roles: ["ADMIN"],
    path: "/admin/users-access",
  },
  {
    id: "roles-permissions",
    label: "Roles & Permissions",
    icon: ShieldCheckIcon,
    roles: ["ADMIN"],
    path: "/admin/roles-permissions",
  },
  {
    id: "activity-log",
    label: "Activity Log",
    icon: HistoryIcon,
    roles: ["ADMIN"],
    path: "/admin/activity-log",
  },
  {
    id: "security",
    label: "Security",
    icon: KeyRoundIcon,
    roles: ["ADMIN"],
    path: "/admin/security",
  },
];

// =====================
// Content Section
// =====================
export const NAV_CONTENT: NavItem[] = [
  {
    id: "blogs",
    label: "Blogs",
    icon: NewspaperIcon,
    roles: ["ADMIN"],
    path: "/admin/blogs",
    countKey: "posts",
  },
  {
    id: "ads",
    label: "Ads",
    icon: MegaphoneIcon,
    roles: ["ADMIN"],
    path: "/admin/ads",
    countKey: "ads",
  },
];
