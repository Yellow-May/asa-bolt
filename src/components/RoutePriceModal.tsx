import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { RoutePricePreview, ServiceLocation } from "../../shared/contracts";
import { ApiError, apiFetch } from "../api";
import { formatNaira } from "../format";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { LocationOrder } from "./LocationOrder";
import { BookingField } from "./BookingField";
import { useBookingValidation } from "../useBookingValidation";

export function RoutePriceModal({
  token,
  locations,
  onClose,
  onSaved,
}: {
  token: string;
  locations: [ServiceLocation, ServiceLocation];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [ordered, setOrdered] = useState(locations);
  const pair = `${ordered[0].id}:${ordered[1].id}`;
  const [result, setResult] = useState<{ pair: string; preview: RoutePricePreview }>();
  const [price, setPrice] = useState<{ pair: string; value: string; edited: boolean }>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<"generate" | "save">();
  const busy = Boolean(operation);
  const { fieldErrors, handleBlur, handleChange, validate, resetValidation } =
    useBookingValidation();
  const lock = useRef(false);
  const current = result?.pair === pair ? result.preview : undefined;
  const amount = price?.pair === pair ? price.value : "";
  const edited = price?.pair === pair && price.edited;
  const originId = ordered[0].id,
    destinationId = ordered[1].id;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setResult(undefined);
    setPrice(undefined);
    setError("");
    apiFetch<RoutePricePreview>("/owner/map-routes/preview", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: { originId, destinationId, action: "current" },
      signal: controller.signal,
    })
      .then((preview) => {
        if (!controller.signal.aborted) {
          setResult({ pair, preview });
          setPrice({ pair, value: String(preview.fare.amountKobo / 100), edited: false });
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof ApiError
              ? failure.message
              : "Could not load the price. Enter one or try Generate price.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [destinationId, originId, pair, token]);
  const handleReverse = useCallback(() => {
    setOrdered(([first, second]) => [second, first]);
    setLoading(true);
    setError("");
    resetValidation();
  }, [resetValidation]);
  const handlePrice = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setPrice({ pair, value: event.target.value, edited: true }),
    [pair],
  );
  const handleGenerate = useCallback(async () => {
    if (lock.current || loading) return;
    lock.current = true;
    setOperation("generate");
    setError("");
    try {
      const preview = await apiFetch<RoutePricePreview>("/owner/map-routes/preview", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { originId, destinationId, action: "calculate" },
      });
      setResult({ pair, preview });
      setPrice({ pair, value: String(preview.fare.amountKobo / 100), edited: false });
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : "Could not generate a price. Try again or enter it yourself.",
      );
    } finally {
      lock.current = false;
      setOperation(undefined);
    }
  }, [destinationId, loading, originId, pair, token]);
  const handleSave = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (lock.current || loading || !validate(event.currentTarget)) return;
      lock.current = true;
      setOperation("save");
      setError("");
      try {
        await apiFetch("/owner/map-routes/save", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: {
            originId,
            destinationId,
            amountNaira: amount,
            priceMode: edited ? "manual" : current?.calculated ? "calculated" : "existing",
          },
        });
        await onSaved();
        onClose();
      } catch (failure) {
        if (failure instanceof ApiError && failure.fare)
          setPrice({ pair, value: String(failure.fare.amountKobo / 100), edited: true });
        setError(
          failure instanceof ApiError
            ? failure.message
            : "Could not save the price. Please try again.",
        );
      } finally {
        lock.current = false;
        setOperation(undefined);
      }
    },
    [
      amount,
      current?.calculated,
      destinationId,
      edited,
      loading,
      onClose,
      onSaved,
      originId,
      pair,
      token,
      validate,
    ],
  );
  return (
    <ConfirmationDialog
      open
      title="Price route"
      description="Drag to choose the starting location."
      busy={busy || loading}
      error={error}
      onClose={onClose}
      footer={
        <button
          className="button button-primary"
          type="submit"
          form="route-price-form"
          disabled={busy || loading}
        >
          {operation === "save" ? "Saving…" : "Save price"}
        </button>
      }
    >
      <LocationOrder locations={ordered} busy={busy || loading} onReverse={handleReverse} />
      {loading ? (
        <p role="status">Loading price…</p>
      ) : (
        <form
          id="route-price-form"
          className="stack-form route-price-form"
          onSubmit={handleSave}
          onBlur={handleBlur}
          onChange={handleChange}
          noValidate
        >
          {current?.previousAmountKobo !== undefined && (
            <p className="field-help">Previous price: {formatNaira(current.previousAmountKobo)}</p>
          )}
          <BookingField name="routePrice" label="Price (₦)" required error={fieldErrors.routePrice}>
            <input
              id="booking-routePrice"
              name="routePrice"
              aria-invalid={Boolean(fieldErrors.routePrice)}
              aria-describedby="booking-routePrice-help"
              inputMode="decimal"
              value={amount}
              onChange={handlePrice}
              pattern="\d+(\.\d{1,2})?"
              required
              disabled={busy}
              autoComplete="off"
            />
          </BookingField>
          <div className="route-price-actions">
            <span className="field-help">
              {current?.fare.pricing?.distanceKm ? `${current.fare.pricing.distanceKm} km` : ""}
            </span>
            <button
              type="button"
              className="button button-secondary"
              onClick={handleGenerate}
              disabled={busy}
            >
              {operation === "generate" ? "Generating…" : "Generate price"}
            </button>
          </div>
        </form>
      )}
    </ConfirmationDialog>
  );
}
