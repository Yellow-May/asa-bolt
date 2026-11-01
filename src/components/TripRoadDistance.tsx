import { useEffect, useState } from "react";
import type { RoadDistance, ServiceLocation } from "../../shared/contracts";
import type { BookingFormValues } from "../booking-form";
import { parseCoordinates } from "../../shared/map-points";
import { apiFetch } from "../api";

export function TripRoadDistance({
  form,
  locations,
}: {
  form: BookingFormValues;
  locations: ServiceLocation[];
}) {
  const origin =
    form.originPin ??
    parseCoordinates(locations.find((item) => item.id === form.originId)?.coordinates ?? "");
  const destination =
    form.destinationPin ??
    parseCoordinates(locations.find((item) => item.id === form.destinationId)?.coordinates ?? "");
  const key =
    origin && destination
      ? JSON.stringify({
          ...(form.originPin ? { originPin: form.originPin } : { originId: form.originId }),
          ...(form.destinationPin
            ? { destinationPin: form.destinationPin }
            : { destinationId: form.destinationId }),
        })
      : "";
  const [result, setResult] = useState<{
    key: string;
    distance?: RoadDistance;
    failed?: boolean;
  }>();
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      apiFetch<RoadDistance>("/routing/distance", {
        method: "POST",
        body: JSON.parse(key),
        signal: controller.signal,
      })
        .then((distance) => {
          if (!controller.signal.aborted) setResult({ key, distance });
        })
        .catch(() => {
          if (!controller.signal.aborted) setResult({ key, failed: true });
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key]);
  if (!key) return undefined;
  const current = result?.key === key ? result : undefined;
  return (
    <p className="field-help trip-road-distance" role="status">
      {current?.distance
        ? `${current.distance.distanceKm} km ${current.distance.provider === "catalogue" ? "route distance" : "by road"}`
        : current?.failed
          ? "Road distance unavailable. You can still request a review."
          : "Calculating road distance…"}
    </p>
  );
}
