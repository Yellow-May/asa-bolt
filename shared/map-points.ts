import type { MapPoint } from "./contracts.js";

export function parseCoordinates(value: string): MapPoint | undefined {
  if (!/^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(value)) return;
  const [latitude, longitude] = value.split(",").map(Number);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return;
  return { latitude, longitude };
}

export function formatCoordinates(point: MapPoint): string {
  return `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
}

export function pointMapUrl(point: MapPoint): string {
  return `https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=17/${point.latitude}/${point.longitude}`;
}
