import {
  PERMISSION_ACTIONS,
  SUPER_ADMIN_ROLE_ID,
  type PermissionAction,
  type RoleDefinition,
  type RolePermissions,
} from "@/types/administration";
import { ALL_PERMISSION_MODULES } from "./permissionCatalog";
import { STAFF_ROLES } from "@/types/staffRole";

/* =========================================================================
   The roles this dashboard starts with: Super Admin, then the four the
   server hands out at sign-in.

   Their matrices are a starting point, not a rule: they describe the shape
   each role is meant to have, and an admin edits them from the screen.
   What a signed-in account may do is still decided by its role on the
   server — this is the place that shape is written down and read back.

   Super Admin is the exception, and deliberately so. It is the account the
   store was seeded with, it always holds every permission, and none of the
   editing on this screen touches it.
   ========================================================================= */

const EVERY_ACTION = PERMISSION_ACTIONS.map((action) => action.id);

/** Full access to every module in the matrix. */
export function everything(): RolePermissions {
  const permissions: RolePermissions = {};
  for (const entry of ALL_PERMISSION_MODULES) permissions[entry.id] = [...EVERY_ACTION];
  return permissions;
}

/** Only the modules named, each with the actions given. */
function only(entries: Record<string, PermissionAction[]>): RolePermissions {
  const permissions: RolePermissions = {};
  for (const entry of ALL_PERMISSION_MODULES) permissions[entry.id] = [];
  for (const [id, actions] of Object.entries(entries)) permissions[id] = [...actions];
  return permissions;
}

const SEEDED = "2024-01-01T00:00:00.000Z";

export const BUILT_IN_ROLES: RoleDefinition[] = [
  {
    id: SUPER_ADMIN_ROLE_ID,
    name: "Super Admin",
    description: "The owner account. Holds every permission, always.",
    icon: "crown",
    roleKey: "ADMIN",
    locked: true,
    status: "ACTIVE",
    permissions: everything(),
    createdAt: SEEDED,
  },
  {
    id: "role-admin",
    name: STAFF_ROLES.ADMIN.singular,
    description: "Full access to every module and setting.",
    icon: "settings",
    roleKey: "ADMIN",
    status: "ACTIVE",
    permissions: everything(),
    createdAt: SEEDED,
  },
  {
    id: "role-shop-manager",
    name: STAFF_ROLES.SHOP_MANAGER.singular,
    description: "Runs day-to-day shop operations, stock and orders.",
    icon: "briefcase",
    roleKey: "SHOP_MANAGER",
    status: "ACTIVE",
    permissions: only({
      overview: ["view"],
      orders: ["view", "create", "edit"],
      inventory: ["view", "edit"],
      products: ["view", "create", "edit"],
      "all-product": ["view", "edit"],
      "add-product": ["view", "create"],
      coupons: ["view", "create", "edit"],
      invoices: ["view"],
      pricing: ["view", "edit"],
      shipping: ["view", "edit"],
      customer: ["view"],
      comment: ["view", "edit"],
      settings: ["view"],
      "help-center": ["view"],
    }),
    createdAt: SEEDED,
  },
  {
    id: "role-media-manager",
    name: STAFF_ROLES.MEDIA_MANAGER.singular,
    description: "Manages product media, stories and campaigns.",
    icon: "image",
    roleKey: "MEDIA_MANAGER",
    status: "ACTIVE",
    permissions: only({
      overview: ["view"],
      blogs: ["view", "create", "edit", "delete"],
      ads: ["view", "create", "edit", "delete"],
      products: ["view"],
      "all-product": ["view"],
      comment: ["view", "edit"],
      settings: ["view"],
      "help-center": ["view"],
    }),
    createdAt: SEEDED,
  },
  {
    id: "role-customer-support",
    name: STAFF_ROLES.CUSTOMER_SUPPORT.singular,
    description: "Answers customer questions, returns and order issues.",
    icon: "headset",
    roleKey: "CUSTOMER_SUPPORT",
    status: "ACTIVE",
    permissions: only({
      overview: ["view"],
      support: ["view", "create", "edit"],
      orders: ["view", "edit"],
      customer: ["view"],
      comment: ["view", "edit"],
      "help-center": ["view"],
    }),
    createdAt: SEEDED,
  },
];

/** A new custom role starts closed: nothing is granted until it is ticked. */
export function emptyPermissions(): RolePermissions {
  return only({});
}
