export const BRAND_CONFIG = {
  name: "Asa Ride",
  city: "Umuahia",
  businessAddress: "52 School road by Stadium, Shop No. 61, Umuahia, Abia State",
  timezone: "Africa/Lagos",
  currency: "NGN",
} as const;

export const MAP_CONFIG = {
  center: { latitude: 5.5333, longitude: 7.486 },
  zoom: 13,
  tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
} as const;

export const BOOKING_STATUSES = [
  "requested",
  "rejected",
  "confirmed",
  "picked_up",
  "arrived",
  "completed",
  "cancelled",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type Actor = "customer" | "owner" | "system";
export type RequestStatus = "pending" | "approved" | "declined";
