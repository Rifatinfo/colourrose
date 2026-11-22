import type { Admin, AdminStatus } from "@/types/admin";
import type { StaffRoleKey } from "@/types/staffRole";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export type ApiListResponse<T> = {
  success: boolean;
  message: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
  data: T;
};

export type GetAdminsParams = {
  /** Which staff role to list. Defaults to ADMIN. */
  role?: StaffRoleKey;
  searchTerm?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
};

export type CreateAdminPayload = {
  name: string;
  email: string;
  password: string;
  /** Stored on the role's own profile row; the API takes it as one string. */
  phone?: string;
  /** The team they join. Omitted leaves the account with none. */
  departmentId?: string;
};

export type UpdateAdminPayload = {
  name?: string;
  email?: string;
  /** An empty string clears the department; omitted leaves it alone. */
  departmentId?: string;
};

async function handleError(res: Response): Promise<never> {
  const error = await res.json().catch(() => ({}));
  throw new Error(error.message ?? `Request failed with status ${res.status}`);
}

export async function getAllAdmins(
  params?: GetAdminsParams
): Promise<ApiListResponse<Admin[]>> {
  const query = new URLSearchParams({ role: params?.role ?? "ADMIN" });
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    }
  }
  const qs = query.toString();
  const res = await fetch(`${API_URL}/api/v1/user${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  if (!res.ok) await handleError(res);
  return res.json();
}

/**
 * Creates a staff account under a role row.
 *
 * There used to be one endpoint per role, which is exactly why a role created
 * in the dashboard could not be assigned: it had no endpoint. The role id
 * travels in the body and the server reads the access level off it.
 */
export async function createStaff(
  roleId: string,
  payload: CreateAdminPayload,
  file?: File | null
): Promise<ApiListResponse<Admin>> {
  const formData = new FormData();
  formData.append("data", JSON.stringify({ ...payload, roleId }));
  if (file) formData.append("file", file);

  const res = await fetch(`${API_URL}/api/v1/user/staff`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function createAdmin(
  payload: CreateAdminPayload,
  file?: File | null
): Promise<ApiListResponse<Admin>> {
  const formData = new FormData();
  formData.append("data", JSON.stringify(payload));
  if (file) formData.append("file", file);

  const res = await fetch(`${API_URL}/api/v1/user/create-admin`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function updateAdmin(
  id: string,
  payload: UpdateAdminPayload,
  file?: File | null
): Promise<ApiListResponse<Admin>> {
  const formData = new FormData();
  formData.append("data", JSON.stringify(payload));
  if (file) formData.append("file", file);

  const res = await fetch(`${API_URL}/api/v1/user/${id}`, {
    method: "PATCH",
    credentials: "include",
    body: formData,
  });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function updateAdminStatus(
  id: string,
  status: AdminStatus
): Promise<ApiListResponse<Admin>> {
  const res = await fetch(`${API_URL}/api/v1/user/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) await handleError(res);
  return res.json();
}

/**
 * Approves an account that is waiting, which is what lets it sign in for the
 * first time. Distinct from reactivating a suspended account: only this
 * stamps the approval.
 */
export async function approveStaff(id: string): Promise<ApiListResponse<Admin>> {
  const res = await fetch(`${API_URL}/api/v1/user/${id}/approve`, {
    method: "PATCH",
    credentials: "include",
  });
  if (!res.ok) await handleError(res);
  return res.json();
}

/**
 * Moves a staff account to another role. Its profile row travels with it, so
 * this is a call of its own rather than a field on the general update.
 */
export async function changeStaffRole(
  id: string,
  role: string
): Promise<ApiListResponse<Admin>> {
  const res = await fetch(`${API_URL}/api/v1/user/${id}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ role }),
  });
  if (!res.ok) await handleError(res);
  return res.json();
}

export async function deleteAdmin(id: string): Promise<ApiListResponse<Admin>> {
  const res = await fetch(`${API_URL}/api/v1/user/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) await handleError(res);
  return res.json();
}
