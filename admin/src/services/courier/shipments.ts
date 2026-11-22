/**
 * The shipping board's data.
 *
 * Read-only: booking a courier lives on the Orders page, behind its
 * confirmation. Nothing here changes a shipment.
 */

import type { CourierName } from "@/types/order";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const BASE = `${API_URL}/api/v1/courier`;

export type ShipmentStage =
  | "AWAITING_DISPATCH"
  | "BOOKED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELED";

export type Shipment = {
  orderId: string;
  orderNo: string;
  placedAt: string;
  customer: { name: string; phone: string; address: string; area: string };
  /** Null until the parcel has been handed to somebody. */
  courier: { name: CourierName; label: string } | null;
  trackingCode: string | null;
  consignmentId: string | null;
  dispatchedAt: string | null;
  stage: ShipmentStage;
  orderStatus: string;
  zone: string | null;
  eta: string;
  deliveredAt: string | null;
  /** Past its delivery window and still not delivered. */
  isLate: boolean;
  itemCount: number;
  codAmount: number;
  totalAmount: number;
};

export type ShipmentSummary = {
  awaitingDispatch: number;
  booked: number;
  inTransit: number;
  deliveredToday: number;
  late: number;
};

export type ShipmentFilters = {
  stage?: ShipmentStage;
  courier?: CourierName;
  late?: boolean;
  search?: string;
  page?: number;
  limit?: number;
};

type Meta = { page: number; limit: number; total: number };

async function request<T>(path: string): Promise<{ data: T; meta?: Meta }> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.message ?? `Request failed with status ${res.status}`);
  }

  return body;
}

export const listShipments = async (filters: ShipmentFilters = {}) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "" && value !== false) query.set(key, String(value));
  }

  const res = await request<Shipment[]>(`/shipments?${query.toString()}`);
  return { data: res.data ?? [], meta: res.meta ?? { page: 1, limit: 20, total: 0 } };
};

export const getShipmentSummary = () =>
  request<ShipmentSummary>("/shipments/summary").then((r) => r.data);
