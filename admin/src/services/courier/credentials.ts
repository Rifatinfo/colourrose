/**
 * Courier credentials, as Settings sees them.
 *
 * Secrets are write-only by design: the server sends a masked preview and
 * never the value, so this module can show what is set without ever holding a
 * key that could leak through a screenshot, an error report or the console.
 */

import type { CourierName } from "@/types/order";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const BASE = `${API_URL}/api/v1/courier`;

export type CredentialField = {
  key: string;
  label: string;
  /** Write-only: `value` is always null and only `preview` comes back. */
  secret: boolean;
  required: boolean;
  hint: string | null;
  placeholder: string | null;
  /** The environment variable it falls back to, shown as provenance. */
  env: string;
  value: string | null;
  preview: string | null;
  set: boolean;
  /** True when the value came from Settings rather than the environment. */
  inDatabase: boolean;
};

export type CourierCredential = {
  courier: CourierName;
  label: string;
  enabled: boolean;
  configured: boolean;
  missing: string[];
  source: 'database' | 'environment' | 'mixed' | 'none';
  baseUrl: string;
  defaultBaseUrl: string;
  updatedAt: string | null;
  fields: CredentialField[];
};

export type CredentialTest = { ok: boolean; message: string; detail?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...init });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.message ?? `Request failed with status ${res.status}`);
  }

  return body.data as T;
}

export const listCourierCredentials = () =>
  request<CourierCredential[]>('/credentials');

export const saveCourierCredential = (
  courier: CourierName,
  input: { values?: Record<string, string>; enabled?: boolean },
) =>
  request<CourierCredential>(`/credentials/${courier}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

export const deleteCourierCredential = (courier: CourierName) =>
  request<CourierCredential>(`/credentials/${courier}`, { method: 'DELETE' });

export const testCourierCredential = (courier: CourierName) =>
  request<CredentialTest>(`/credentials/${courier}/test`, { method: 'POST' });
