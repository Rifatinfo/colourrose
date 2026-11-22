import type { StaffRoleKey } from "./staffRole";

/* =========================================================================
   Administration — the shared vocabulary for Users & Access, Roles &
   Permissions, Activity Log and Security.
   ========================================================================= */

/* ------------------------------ Team members ---------------------------- */

/**
 * How an account reads on the Users & Access screen. `PENDING` is not a
 * server status: it is an ACTIVE account that has never chosen its own
 * password, which is exactly what an unaccepted invitation looks like.
 */
export type AccessStatus = "ACTIVE" | "INACTIVE" | "PENDING" | "DELETED";

export const ACCESS_STATUS_META: Record<
  AccessStatus,
  { label: string; dot: string; text: string }
> = {
  ACTIVE: { label: "Active", dot: "bg-emerald-500", text: "text-slate-700" },
  INACTIVE: { label: "Inactive", dot: "bg-slate-400", text: "text-slate-500" },
  PENDING: { label: "Pending", dot: "bg-amber-500", text: "text-slate-700" },
  DELETED: { label: "Deleted", dot: "bg-rose-500", text: "text-slate-500" },
};

/* ------------------------------ Permissions ----------------------------- */

export type PermissionAction = "view" | "create" | "edit" | "delete" | "manage";

export const PERMISSION_ACTIONS: { id: PermissionAction; label: string }[] = [
  { id: "view", label: "View" },
  { id: "create", label: "Create" },
  { id: "edit", label: "Edit" },
  { id: "delete", label: "Delete" },
  { id: "manage", label: "Manage" },
];

/*
  The matrix rows live in services/administration/permissionCatalog.ts, which
  derives them from the sidebar so a new route needs no second list here.
*/

/** module id -> the actions the role may take on it. */
export type RolePermissions = Record<string, PermissionAction[]>;

/**
 * `ACTIVE` roles are the four the server recognises and hands out at sign-in.
 * `DRAFT` roles are defined here but cannot be assigned to anyone until the
 * server can store them, which is what keeps the two lists honest.
 */
export type RoleStatus = "ACTIVE" | "DRAFT" | "INACTIVE";

export const ROLE_STATUS_META: Record<
  RoleStatus,
  { label: string; dot: string; chip: string }
> = {
  ACTIVE: { label: "Active", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
  DRAFT: { label: "Draft", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600" },
  INACTIVE: { label: "Inactive", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600" },
};

export type RoleIconKey =
  | "crown"
  | "settings"
  | "briefcase"
  | "coin"
  | "image"
  | "headset"
  | "box"
  | "shield";

/** The one role that is not editable: the account the store was seeded with. */
export const SUPER_ADMIN_ROLE_ID = "role-super-admin";

export type RoleDefinition = {
  id: string;
  name: string;
  description: string;
  icon: RoleIconKey;
  /** Maps to a role the server hands out at sign-in; null on a draft. */
  roleKey: StaffRoleKey | null;
  /**
   * Super Admin only. It always holds every permission, and nothing on this
   * screen can rename, narrow or remove it — it is the account that has to be
   * able to put everything else back.
   */
  locked?: boolean;
  status: RoleStatus;
  permissions: RolePermissions;
  createdAt: string;
};

/* ------------------------------ Activity log ---------------------------- */

export type ActivityStatus = "SUCCESS" | "FAILED";

export type ActivityModule =
  | "Administration"
  | "Orders"
  | "Customers"
  | "Products"
  | "Blogs"
  | "Finance"
  | "Website";

export type ActivityEntry = {
  id: string;
  /** ISO timestamp. */
  at: string;
  actorName: string;
  actorRole: string;
  actorAvatar?: string | null;
  action: string;
  module: ActivityModule;
  details: string;
  status: ActivityStatus;
  /** Extra rows for the detail panel, in display order. */
  facts?: { label: string; value: string }[];
};

/* -------------------------------- Security ------------------------------ */

export type SecuritySettings = {
  /* Authentication */
  twoFactor: boolean;
  emailLogin: boolean;
  /** Minutes. */
  sessionTimeout: number;
  rememberMe: boolean;

  /* Password policy */
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
  /** Days; 0 means passwords never expire. */
  passwordExpiry: number;

  /* Access control */
  restrictByIp: boolean;
  allowedIps: string[];
  blockSuspicious: boolean;
  maxFailedAttempts: number;
  /** Minutes. */
  lockoutDuration: number;
};

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  twoFactor: true,
  emailLogin: true,
  sessionTimeout: 30,
  rememberMe: false,

  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  passwordExpiry: 90,

  restrictByIp: false,
  allowedIps: [],
  blockSuspicious: true,
  maxFailedAttempts: 5,
  lockoutDuration: 30,
};
