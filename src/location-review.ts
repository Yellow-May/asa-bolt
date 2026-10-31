import type { LocationRequest, ServiceLocation } from "../shared/contracts";
import { CUSTOM_LOCATION, type BookingFormValues } from "./booking-form";

export function locationReviewInput(
  form: BookingFormValues,
  locations: ServiceLocation[],
  key: string,
): Omit<LocationRequest, "id" | "status" | "responseNote" | "createdAt"> {
  const origin =
    form.originId === CUSTOM_LOCATION
      ? form.customOrigin.trim()
      : (locations.find((location) => location.id === form.originId)?.name ?? "");
  const destination =
    form.destinationId === CUSTOM_LOCATION
      ? form.customDestination.trim()
      : (locations.find((location) => location.id === form.destinationId)?.name ?? "");
  return {
    idempotencyKey: key,
    requesterName: "",
    email: form.contactMethod === "email" ? form.email.trim() : "",
    phone: form.contactMethod === "whatsapp" ? form.whatsappNumber : "",
    locationName: form.originId === CUSTOM_LOCATION ? origin : destination,
    landmark: form.pickupNote,
    mapsUrl: "",
    trip: {
      origin,
      destination,
      pickupAt: new Date(`${form.pickupAt}:00+01:00`).toISOString(),
      pickupNote: form.pickupNote,
      customLocations: [
        form.originId === CUSTOM_LOCATION && !form.originPin ? origin : "",
        form.destinationId === CUSTOM_LOCATION && !form.destinationPin ? destination : "",
      ].filter(Boolean),
      originPin: form.originPin,
      destinationPin: form.destinationPin,
    },
  };
}
