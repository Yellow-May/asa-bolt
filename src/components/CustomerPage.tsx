import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AvailableSchedule,
  BookingAccessResponse,
  LocationRequest,
  MapPoint,
  FarePreview,
  OfferPreview,
  ServiceLocation,
  ServiceRoute,
} from "../../shared/contracts";
import {
  ApiError,
  createBooking,
  createLocationRequest,
  getAvailability,
  fetchFare,
  fetchCustomerSetup,
  previewPriceOffer,
} from "../api";
import { formatNaira } from "../format";
import { BookingSummary } from "./BookingSummary";
import { BookingJourneyFields } from "./BookingJourneyFields";
import { BookingFareFields } from "./BookingFareFields";
import { BookingContactFields } from "./BookingContactFields";
import { CUSTOM_LOCATION } from "../booking-form";
import { useBookingContact } from "../useBookingContact";
import { LocationReviewSummary } from "./LocationReviewSummary";
import { locationReviewInput } from "../location-review";
import { useBookingValidation } from "../useBookingValidation";
import { Message } from "./Message";

export function CustomerPage({
  initialCustomLocation = false,
}: {
  initialCustomLocation?: boolean;
}) {
  const [routes, setRoutes] = useState<Pick<ServiceRoute, "id" | "originId" | "destinationId">[]>(
    [],
  );
  const [locations, setLocations] = useState<ServiceLocation[]>([]);
  const [availability, setAvailability] = useState<AvailableSchedule[]>([]);
  const { fieldErrors, handleBlur, handleChange, validate, resetValidation } =
    useBookingValidation();
  const {
    form,
    setForm,
    savedContact,
    storageError,
    handleContactChange,
    handleMethodChange,
    rememberBookingContact,
    handleForgetContact,
    resetTrip,
  } = useBookingContact(initialCustomLocation, resetValidation);
  const [fare, setFare] = useState<FarePreview>();
  const [result, setResult] = useState<BookingAccessResponse>();
  const [locationResult, setLocationResult] = useState<LocationRequest>();
  const [checkingDate, setCheckingDate] = useState(false);
  const [dateError, setDateError] = useState("");
  const dateRequestRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [priceChoice, setPriceChoice] = useState<"accept" | "negotiate">("accept");
  const [offerAmount, setOfferAmount] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [offerResult, setOfferResult] = useState<{
    input: string;
    preview?: OfferPreview;
    error?: string;
  }>();
  const offer = offerResult?.input === offerAmount ? offerResult.preview : undefined;
  const offerError = offerResult?.input === offerAmount ? offerResult.error : "";
  const canSubmitPrice = priceChoice === "accept" || Boolean(offer);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fareError, setFareError] = useState("");
  const keyRef = useRef(crypto.randomUUID());
  const submittingRef = useRef(false);
  const pickupDate = form.pickupAt.slice(0, 10);
  const customTrip = form.originId === CUSTOM_LOCATION || form.destinationId === CUSTOM_LOCATION;

  useEffect(() => {
    let active = true;
    fetchCustomerSetup()
      .then((setup) => {
        if (active) {
          setLocations(setup.locations);
          setRoutes(setup.routes);
          setAvailability(setup.availability);
        }
      })
      .catch(() => {
        if (active)
          setError("The booking service is temporarily unavailable. Please try again shortly.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (
      !form.originId ||
      !form.destinationId ||
      !pickupDate ||
      customTrip ||
      form.originId === form.destinationId
    )
      return;
    setQuoting(true);
    fetchFare(form.originId, form.destinationId, pickupDate)
      .then((quote) => {
        if (active) {
          setFare(quote);
          setFareError("");
        }
      })
      .catch(() => {
        if (active)
          setFareError(
            "This route is unavailable for the selected day. Choose another route or day, or use Request a location.",
          );
      })
      .finally(() => {
        if (active) setQuoting(false);
      });
    return () => {
      active = false;
    };
  }, [form.originId, form.destinationId, pickupDate, customTrip]);

  useEffect(() => {
    if (priceChoice !== "negotiate" || !offerAmount.trim()) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      previewPriceOffer(offerAmount, controller.signal)
        .then((preview) => {
          if (!controller.signal.aborted) setOfferResult({ input: offerAmount, preview });
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted)
            setOfferResult({
              input: offerAmount,
              error:
                error instanceof Error
                  ? error.message
                  : "We could not preview your offer. Try again.",
            });
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [offerAmount, priceChoice]);

  const changeQuoteField = useCallback(
    (name: "originId" | "destinationId" | "pickupAt", value: string) => {
      setForm((current) => ({
        ...current,
        [name]: value,
        ...(name === "originId" ? { destinationId: "" } : {}),
        ...(name === "originId"
          ? { originPin: undefined, destinationPin: undefined }
          : name === "destinationId"
            ? { destinationPin: undefined }
            : {}),
      }));
      if (name !== "pickupAt" || value.slice(0, 10) !== pickupDate) {
        setFare(undefined);
        setFareError("");
        setQuoting(false);
      }
      setError("");
    },
    [pickupDate, setForm],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submittingRef.current || !validate(event.currentTarget)) return;
      const pickupTime = form.pickupAt.slice(11, 16);
      if (
        checkingDate ||
        dateError ||
        !availability.some(
          (window) =>
            window.date === pickupDate &&
            pickupTime >= window.startTime &&
            pickupTime < window.endTime,
        )
      ) {
        setDateError("Choose an available pickup date and time.");
        event.currentTarget.querySelector<HTMLInputElement>("#booking-schedule")?.focus();
        return;
      }
      if (!customTrip && (!fare || !canSubmitPrice || !form.pickupAt)) {
        setError(
          !fare
            ? "Choose your route and pickup day, then wait for your fare before sending."
            : "Review your rounded offer and confirm the fare before sending.",
        );
        return;
      }
      submittingRef.current = true;
      setSubmitting(true);
      setError("");
      try {
        if (customTrip) {
          const request = await createLocationRequest(
            locationReviewInput(form, locations, keyRef.current),
          );
          rememberBookingContact(request);
          setLocationResult(request);
          window.scrollTo(0, 0);
          return;
        }
        if (!fare) return;
        const booking = await createBooking({
          ...form,
          email: form.contactMethod === "email" ? form.email.trim() : "",
          phone: form.contactMethod === "whatsapp" ? form.whatsappNumber : "",
          whatsappNumber: "",
          pickupAt: new Date(`${form.pickupAt}:00+01:00`).toISOString(),
          quotedAmountKobo: fare.amountKobo,
          priceChoice,
          ...(priceChoice === "negotiate" && offer
            ? {
                proposedAmountNaira: offerAmount,
                proposedAmountKobo: offer.roundedAmountKobo,
                negotiationNote: offerNote,
              }
            : {}),
          idempotencyKey: keyRef.current,
        });
        rememberBookingContact(booking.booking);
        setResult(booking);
        window.scrollTo(0, 0);
      } catch (failure) {
        if (failure instanceof ApiError && failure.fare) {
          setFare(failure.fare);
        } else if (failure instanceof ApiError && failure.offer) {
          setOfferResult({ input: offerAmount, preview: failure.offer });
        }
        setError(
          failure instanceof Error
            ? failure.message
            : "We could not save this request. Please try again.",
        );
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [
      validate,
      rememberBookingContact,
      checkingDate,
      dateError,
      availability,
      pickupDate,
      customTrip,
      fare,
      canSubmitPrice,
      form,
      locations,
      priceChoice,
      offer,
      offerAmount,
      offerNote,
    ],
  );

  const handleNewBooking = useCallback(() => {
    setResult(undefined);
    setLocationResult(undefined);
    resetTrip();
    setPriceChoice("accept");
    setOfferAmount("");
    setOfferNote("");
    setOfferResult(undefined);
    setFare(undefined);
    setError("");
    setDateError("");
    keyRef.current = crypto.randomUUID();
    resetValidation();
  }, [resetValidation, resetTrip]);

  const handleCustomChange = useCallback(
    (name: "customOrigin" | "customDestination" | "pickupNote", value: string) => {
      setForm((current) => ({ ...current, [name]: value }));
    },
    [setForm],
  );
  const handlePinChange = useCallback(
    (name: "originPin" | "destinationPin", point: MapPoint) => {
      setForm((current) => ({
        ...current,
        [name]: point,
        ...(name === "originPin"
          ? {
              originId: CUSTOM_LOCATION,
              customOrigin:
                current.customOrigin ||
                locations.find((location) => location.id === current.originId)?.name ||
                "Pinned pickup",
            }
          : {
              destinationId: CUSTOM_LOCATION,
              customDestination:
                current.customDestination ||
                locations.find((location) => location.id === current.destinationId)?.name ||
                "Pinned destination",
            }),
      }));
      setFare(undefined);
      setFareError("");
      setError("");
    },
    [locations, setForm],
  );
  const handleDateChange = useCallback(
    async (date: string) => {
      const request = ++dateRequestRef.current;
      changeQuoteField("pickupAt", date ? `${date}T` : "");
      setDateError("");
      setAvailability([]);
      setCheckingDate(Boolean(date));
      if (!date) return;
      try {
        const result = await getAvailability(date);
        if (request !== dateRequestRef.current) return;
        setAvailability(result.available ? result.windows : []);
        if (!result.available) setDateError("No pickups available on this date.");
      } catch {
        if (request === dateRequestRef.current)
          setDateError("Could not load pickup hours. Choose the date again.");
      } finally {
        if (request === dateRequestRef.current) setCheckingDate(false);
      }
    },
    [changeQuoteField],
  );
  const handleTimeChange = useCallback(
    (value: string) => {
      setForm((current) => ({ ...current, pickupAt: `${current.pickupAt.slice(0, 10)}T${value}` }));
      setDateError("");
    },
    [setForm],
  );
  const handlePriceChoice = useCallback((value: "accept" | "negotiate") => {
    setPriceChoice(value);
  }, []);
  const handleOfferAmount = useCallback((value: string) => {
    setOfferAmount(value);
    setOfferResult(undefined);
  }, []);
  const handleOfferNote = useCallback((value: string) => setOfferNote(value), []);
  const handleRetry = useCallback(() => window.location.reload(), []);

  if (locationResult)
    return <LocationReviewSummary request={locationResult} onNewBooking={handleNewBooking} />;
  if (result)
    return (
      <main className="narrow-page">
        <BookingSummary
          booking={result.booking}
          statusUrl={result.statusUrl}
          onNewBooking={handleNewBooking}
        />
      </main>
    );
  return (
    <main className="customer-shell">
      <header className="booking-intro">
        {initialCustomLocation && (
          <a className="booking-back" href="/" aria-label="Back to booking">
            ←
          </a>
        )}
        <h1>Where are you headed?</h1>
      </header>
      <div className="booking-layout">
        <section className="booking-panel" aria-label="Request a ride">
          {loading && <Message tone="info">Loading available routes and pickup times…</Message>}
          {error && <Message tone="error">{error}</Message>}
          {!loading && error && routes.length === 0 && (
            <button className="button button-secondary" type="button" onClick={handleRetry}>
              Try again
            </button>
          )}
          {!loading && (!error || locations.length > 0) && (
            <form
              className="booking-form"
              onSubmit={handleSubmit}
              onBlur={handleBlur}
              onChange={handleChange}
              noValidate
              aria-busy={submitting}
            >
              <BookingJourneyFields
                form={form}
                locations={locations}
                routes={routes}
                availability={availability}
                checkingDate={checkingDate}
                dateError={dateError}
                submitting={submitting}
                errors={fieldErrors}
                onQuoteChange={changeQuoteField}
                onTimeChange={handleTimeChange}
                onCustomChange={handleCustomChange}
                onDateChange={handleDateChange}
                onPinChange={handlePinChange}
              />
              {!customTrip && (fare || quoting || fareError) && (
                <BookingFareFields
                  fare={fare}
                  quoting={quoting}
                  fareError={fareError}
                  priceChoice={priceChoice}
                  offerAmount={offerAmount}
                  offerNote={offerNote}
                  offer={offer}
                  offerError={offerError}
                  submitting={submitting}
                  errors={fieldErrors}
                  onPriceChoice={handlePriceChoice}
                  onOfferAmount={handleOfferAmount}
                  onOfferNote={handleOfferNote}
                />
              )}
              {customTrip && (
                <p className="field-help">
                  The admin will review this route. A fare will be provided separately.
                </p>
              )}
              {(fare || customTrip) && (
                <BookingContactFields
                  form={form}
                  submitting={submitting}
                  errors={fieldErrors}
                  onChange={handleContactChange}
                  onMethodChange={handleMethodChange}
                  savedContact={Boolean(savedContact)}
                  storageError={storageError}
                  onForgetContact={handleForgetContact}
                />
              )}
              <div className="booking-submit">
                {fare && (
                  <p className="field-help">
                    Your request needs confirmation. Unanswered requests expire at pickup time.
                  </p>
                )}
                <button
                  className="button button-primary button-wide"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting
                    ? "Sending request…"
                    : customTrip
                      ? "Send for review"
                      : fare
                        ? priceChoice === "negotiate"
                          ? `Send offer · ${offer ? formatNaira(offer.roundedAmountKobo) : "review amount"}`
                          : `Request ride · ${formatNaira(fare.amountKobo)}`
                        : quoting
                          ? "Getting fare…"
                          : "See fare"}{" "}
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
