import type {
  PermissionAction,
  RoleDefinition,
  RoleIconKey,
  RolePermissions,
} from "@/types/administration";
import type { StaffRoleKey } from "@/types/staffRole";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/* =========================================================================
   Roles, from the API.

   They used to live in this browser's localStorage, which is why a role
   created here could never be handed to anybody: the Add User form had no
   way to know it existed. They are rows now, and this maps them onto the
   `RoleDefinition` the screens already use, so the UI itself is unchanged.
   ========================================================================= */

/** The row as the API returns it. */
type ApiRole = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  baseRole: StaffRoleKey;
  isSuperAdmin: boolean;
  isActive: boolean;
  permissions: Record<string, PermissionAction[]> | null;
  userCount: number;
  createdAt: string;
  updatedAt: string;
};

const ICONS: RoleIconKey[] = [
  "crown",
  "settings",
  "briefcase",
  "coin",
  "image",
  "headset",
  "box",
  "shield",
];

function toDefinition(role: ApiRole): RoleDefinition & { userCount: number } {
  return {
    id: role.id,
    name: role.name,
    description: role.description ?? "",
    icon: (ICONS.includes(role.icon as RoleIconKey) ? role.icon : "shield") as RoleIconKey,
    // `roleKey` is the access level the server grants this role's accounts.
    roleKey: role.baseRole,
    locked: role.isSuperAdmin,
    status: role.isActive ? "ACTIVE" : "INACTIVE",
    permissions: (role.permissions ?? {}) as RolePermissions,
    createdAt: role.createdAt,
    userCount: role.userCount,
  };
}

async function handleError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}));
  throw new Error(body.message ?? `Request failed with status ${res.status}`);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1/role${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) await handleError(res);
  return (await res.json()).data as T;
}

export async function getRoles(): Promise<(RoleDefinition & { userCount: number })[]> {
  const rows = await request<ApiRole[]>("");
  return rows.map(toDefinition);
}

export async function createRole(payload: {
  name: string;
  description?: string;
  icon?: string;
  baseRole: StaffRoleKey;
  permissions?: RolePermissions;
}) {
  const role = await request<ApiRole>("", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return toDefinition(role);
}

export async function updateRole(
  id: string,
  payload: {
    name?: string;
    description?: string;
    icon?: string;
    baseRole?: StaffRoleKey;
    permissions?: RolePermissions;
    isActive?: boolean;
  }
) {
  const role = await request<ApiRole>(`/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return toDefinition(role);
}

/** Refused by the API while anybody still holds the role. */
export async function deleteRole(id: string) {
  return request<{ id: string; name: string }>(`/${id}`, { method: "DELETE" });
}
