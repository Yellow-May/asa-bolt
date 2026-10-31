import { useCallback, type ChangeEvent } from "react";
import type {
  AvailableSchedule,
  MapPoint,
  ServiceLocation,
  ServiceRoute,
} from "../../shared/contracts";
import { CUSTOM_LOCATION, type BookingFieldErrors, type BookingFormValues } from "../booking-form";
import { BookingField } from "./BookingField";
import { Dropdown } from "./Dropdown";
import { parseCoordinates } from "../../shared/map-points";
import { TripRoadDistance } from "./TripRoadDistance";
import { MapLocationPicker } from "./MapLocationPicker";
import "../map.css";

interface BookingJourneyFieldsProps {
  form: BookingFormValues;
  locations: ServiceLocation[];
  routes: Pick<ServiceRoute, "id" | "originId" | "destinationId">[];
  availability: AvailableSchedule[];
  checkingDate: boolean;
  dateError: string;
  submitting: boolean;
  errors: BookingFieldErrors;
  onQuoteChange: (name: "originId" | "destinationId" | "pickupAt", value: string) => void;
  onCustomChange: (
    name: "customOrigin" | "customDestination" | "pickupNote",
    value: string,
  ) => void;
  onDateChange: (date: string) => void;
  onTimeChange: (value: string) => void;
  onPinChange: (name: "originPin" | "destinationPin", point: MapPoint) => void;
}

export function BookingJourneyFields({
  form,
  locations,
  routes,
  availability,
  checkingDate,
  dateError,
  submitting,
  errors,
  onQuoteChange,
  onCustomChange,
  onDateChange,
  onTimeChange,
  onPinChange,
}: BookingJourneyFieldsProps) {
  const handleOriginPin = useCallback(
    (point: MapPoint) => onPinChange("originPin", point),
    [onPinChange],
  );
  const handleDestinationPin = useCallback(
    (point: MapPoint) => onPinChange("destinationPin", point),
    [onPinChange],
  );
  const pickupDate = form.pickupAt.slice(0, 10);
  const pickupTime = form.pickupAt.slice(11, 16);
  const windows = availability.filter((item) => item.date === pickupDate);
  const selectedWindow = windows.find(
    (item) => pickupTime >= item.startTime && pickupTime < item.endTime,
  );
  const pickupLocations = locations.filter((location) =>
    routes.some((route) => route.originId === location.id),
  );
  const destinations = locations.filter(
    (location) =>
      form.originId === CUSTOM_LOCATION ||
      routes.some(
        (route) => route.originId === form.originId && route.destinationId === location.id,
      ),
  );
  const timeError =
    pickupTime && !checkingDate && !selectedWindow
      ? "Choose a time within pickup hours."
      : errors.pickupAt;
  const handlePickupChange = useCallback(
    (value: string) => onQuoteChange("originId", value),
    [onQuoteChange],
  );
  const handleDestinationChange = useCallback(
    (value: string) => onQuoteChange("destinationId", value),
    [onQuoteChange],
  );
  const handleDateChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onDateChange(event.target.value),
    [onDateChange],
  );
  const handleTimeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onTimeChange(event.target.value),
    [onTimeChange],
  );
  const handleTextChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onCustomChange(
        event.target.name as "customOrigin" | "customDestination" | "pickupNote",
        event.target.value,
      ),
    [onCustomChange],
  );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <fieldset className="booking-section" disabled={submitting}>
      <legend className="sr-only">Your journey</legend>
      <div className="booking-fields-row">
        <BookingField
          name="originId"
          label="Pickup location"
          required
          error={errors.originId}
          action={
            <MapLocationPicker
              label="Pickup"
              point={
                form.originPin ??
                parseCoordinates(
                  locations.find((item) => item.id === form.originId)?.coordinates ?? "",
                )
              }
              onChoose={handleOriginPin}
            />
          }
        >
          <Dropdown
            id="booking-originId"
            name="originId"
            label="Pickup location"
            value={form.originId}
            onValueChange={handlePickupChange}
            required
            invalid={Boolean(errors.originId)}
            placeholder="Choose pickup location"
            options={locationOptions(pickupLocations)}
          />

          {form.originId === CUSTOM_LOCATION && (
            <BookingField
              name="customOrigin"
              label="Enter pickup location"
              required
              error={errors.customOrigin}
            >
              <input
                id="booking-customOrigin"
                name="customOrigin"
                value={form.customOrigin}
                onChange={handleTextChange}
                maxLength={120}
                required
                aria-invalid={Boolean(errors.customOrigin)}
              />
            </BookingField>
          )}
        </BookingField>
        <BookingField
          name="destinationId"
          label="Destination"
          required
          error={errors.destinationId}
          action={
            <MapLocationPicker
              label="Destination"
              point={
                form.destinationPin ??
                parseCoordinates(
                  locations.find((item) => item.id === form.destinationId)?.coordinates ?? "",
                )
              }
              onChoose={handleDestinationPin}
            />
          }
        >
          <Dropdown
            id="booking-destinationId"
            name="destinationId"
            label="Destination"
            value={form.destinationId}
            onValueChange={handleDestinationChange}
            required
            invalid={Boolean(errors.destinationId)}
            placeholder="Choose destination"
            options={locationOptions(destinations)}
          />

          {form.destinationId === CUSTOM_LOCATION && (
            <BookingField
              name="customDestination"
              label="Enter destination"
              required
              error={errors.customDestination}
            >
              <input
                id="booking-customDestination"
                name="customDestination"
                value={form.customDestination}
                onChange={handleTextChange}
                maxLength={120}
                required
                aria-invalid={Boolean(errors.customDestination)}
              />
            </BookingField>
          )}
        </BookingField>
      </div>
      <div className="booking-fields-row booking-date-row">
        <BookingField
          name="schedule"
          label="Pickup date"
          required
          error={dateError || errors.schedule}
        >
          <input
            id="booking-schedule"
            name="schedule"
            type="date"
            value={pickupDate}
            min={today}
            onChange={handleDateChange}
            required
            aria-invalid={Boolean(dateError || errors.schedule)}
            aria-describedby="booking-schedule-help"
          />
        </BookingField>
        <BookingField
          name="pickupAt"
          label="Pickup time"
          required
          error={timeError}
          help={
            checkingDate
              ? "Checking pickup hours…"
              : windows.length
                ? windows.map((item) => `${item.startTime}–${item.endTime}`).join(", ")
                : undefined
          }
        >
          <input
            id="booking-pickupAt"
            name="pickupAt"
            type="time"
            value={pickupTime}
            disabled={!pickupDate || checkingDate || !windows.length}
            onChange={handleTimeChange}
            required
            aria-invalid={Boolean(timeError)}
            aria-describedby="booking-pickupAt-help"
          />
        </BookingField>
      </div>
      <BookingField name="pickupNote" label="Pickup note">
        <textarea
          id="booking-pickupNote"
          name="pickupNote"
          rows={2}
          maxLength={240}
          value={form.pickupNote}
          onChange={handleTextChange}
          placeholder="Landmark or pickup details"
        />
      </BookingField>
      <TripRoadDistance form={form} locations={locations} />
    </fieldset>
  );
}

function locationOptions(locations: ServiceLocation[]) {
  return [...locations]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((location) => ({ value: location.id, label: location.name }))
    .concat({ value: CUSTOM_LOCATION, label: "Enter another location…" });
}
