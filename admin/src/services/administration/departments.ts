const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/* =========================================================================
   Departments — the teams an account can belong to.

   Server-backed, unlike the permission grids: a department one admin creates
   has to be there for the next admin who opens the Add User form, and the
   assignment travels with the account rather than with the browser.
   ========================================================================= */

export type Department = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** How many accounts are currently in it. */
  userCount: number;
  createdAt: string;
  updatedAt: string;
};

async function handleError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}));
  throw new Error(body.message ?? `Request failed with status ${res.status}`);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1/department${path}`, {
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

export const getDepartments = () => request<Department[]>("");

export const createDepartment = (payload: { name: string; description?: string }) =>
  request<Department>("", { method: "POST", body: JSON.stringify(payload) });

export const updateDepartment = (
  id: string,
  payload: { name?: string; description?: string }
) => request<Department>(`/${id}`, { method: "PATCH", body: JSON.stringify(payload) });

/**
 * Removes the department. Nobody is removed with it — everyone in it is
 * released, and their account keeps working with no department set.
 */
export const deleteDepartment = (id: string) =>
  request<{ id: string; name: string }>(`/${id}`, { method: "DELETE" });
