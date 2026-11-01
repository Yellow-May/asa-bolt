import type { MapPoint } from "../../shared/contracts.js";
import { HttpError } from "../errors.js";

export function optionalMapPoint(value: unknown): MapPoint | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") throw new HttpError(400, "Choose a valid map location.");
  const { latitude, longitude } = value as Record<string, unknown>;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    throw new HttpError(400, "Choose a valid map location.");
  return { latitude, longitude };
}
