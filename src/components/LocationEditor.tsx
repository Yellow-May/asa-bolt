import { useCallback, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { MapPoint, ServiceLocation } from "../../shared/contracts";
import { formatCoordinates, parseCoordinates, pointMapUrl } from "../../shared/map-points";
import { MapLocationPicker } from "./MapLocationPicker";
import { apiFetch } from "../api";
import { useBookingValidation } from "../useBookingValidation";
import { BookingField } from "./BookingField";
import { ConfirmationDialog } from "./ConfirmationDialog";

interface LocationEditorProps {
  token: string;
  location?: ServiceLocation;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function LocationEditor({ token, location, onClose, onSaved }: LocationEditorProps) {
  const [value, setValue] = useState(() => ({
    id: location?.id ?? "new",
    name: location?.name ?? "",
    landmark: location?.landmark ?? "",
    mapsUrl: location?.mapsUrl ?? "",
    coordinates: location?.coordinates ?? "",
    published: location?.published ?? false,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const { fieldErrors, handleBlur, handleChange, validate } = useBookingValidation();
  const handleFieldChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked, type } = event.target;
    setValue((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }, []);
  const handlePin = useCallback((point: MapPoint) => {
    setValue((current) => ({
      ...current,
      coordinates: formatCoordinates(point),
      mapsUrl: pointMapUrl(point),
    }));
  }, []);
  const handleSave = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (lock.current || !validate(event.currentTarget)) return;
      lock.current = true;
      setBusy(true);
      setError("");
      try {
        await apiFetch(`/owner/locations/${value.id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
          body: value,
        });
        await onSaved();
        onClose();
      } catch {
        setError("Could not save this location. Check the details and try again.");
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [onClose, onSaved, token, validate, value],
  );

  return (
    <ConfirmationDialog
      open
      title={location ? "Edit location" : "Add location"}
      description="Choose which locations customers can book."
      busy={busy}
      error={error}
      onClose={onClose}
      footer={
        <button
          className="button button-primary"
          type="submit"
          form="location-editor"
          disabled={busy}
        >
          {busy ? "Saving…" : "Save location"}
        </button>
      }
    >
      <form
        id="location-editor"
        className="stack-form"
        onSubmit={handleSave}
        onBlur={handleBlur}
        onChange={handleChange}
        noValidate
      >
        <BookingField
          name="name"
          label="Name"
          required
          error={fieldErrors.name}
          action={
            <MapLocationPicker
              label="Location"
              point={parseCoordinates(value.coordinates)}
              onChoose={handlePin}
            />
          }
        >
          <input
            id="booking-name"
            name="name"
            value={value.name}
            onChange={handleFieldChange}
            required
            pattern=".*\S.*"
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby="booking-name-help"
            disabled={busy}
          />
        </BookingField>
        <BookingField name="landmark" label="Landmark" required error={fieldErrors.landmark}>
          <input
            id="booking-landmark"
            name="landmark"
            value={value.landmark}
            onChange={handleFieldChange}
            required
            pattern=".*\S.*"
            aria-invalid={Boolean(fieldErrors.landmark)}
            aria-describedby="booking-landmark-help"
            disabled={busy}
          />
        </BookingField>
        <BookingField name="mapsUrl" label="Map URL" error={fieldErrors.mapsUrl}>
          <input
            id="booking-mapsUrl"
            name="mapsUrl"
            type="url"
            value={value.mapsUrl}
            onChange={handleFieldChange}
            aria-invalid={Boolean(fieldErrors.mapsUrl)}
            aria-describedby="booking-mapsUrl-help"
            disabled={busy}
          />
        </BookingField>
        <label className="checkbox-label">
          <input
            name="published"
            type="checkbox"
            checked={value.published}
            onChange={handleFieldChange}
            disabled={busy}
          />
          Published for customers
        </label>
        {location?.published && !value.published && (
          <p className="field-help">
            Hiding this location also makes its routes unavailable for new bookings.
          </p>
        )}
      </form>
    </ConfirmationDialog>
  );
}
