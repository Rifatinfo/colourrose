/**
 * Handing an order to a delivery partner.
 *
 * The only thing the dashboard sends is *which* courier. Everything the
 * courier receives — the address, the phone, the amount to collect — is read
 * from the order on the server, so nothing on this side can change what a
 * rider turns up asking for.
 */

import type { CourierName } from "@/types/order";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const BASE = `${API_URL}/api/v1/courier`;

export type CourierOption = {
  name: CourierName;
  label: string;
  /** False when its credentials are missing; the dropdown says so. */
  configured: boolean;
  missing: string[];
};

export type BookingResult = {
  id: string;
  orderNo: string;
  courier: CourierName;
  courierConsignmentId: string;
  courierTrackingCode: string | null;
  courierSentAt: string;
  /** What the rider will collect at the door. Zero for an order already paid. */
  codAmount: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include", ...init });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.message ?? `Request failed with status ${res.status}`);
  }

  return body.data as T;
}

export const listCouriers = () => request<CourierOption[]>("");

export const bookOrderWithCourier = (orderId: string, courier: CourierName) =>
  request<BookingResult>(`/orders/${orderId}/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courier }),
  });
