import { useCallback, useEffect, useState } from "react";
import type { ContactMethod, RequestHistory } from "../../shared/contracts";
import {
  ApiError,
  closeRequestHistory,
  fetchRequestHistory,
  requestHistoryLink,
  verifyHistoryLink,
} from "../api";
import { formatDateTime, statusLabel } from "../format";
import { FareDetails } from "./FareDetails";
import { Message } from "./Message";
import { ContactMethodChoice } from "./ContactMethodChoice";
import { LocationPins } from "./LocationPins";
import { BookingField } from "./BookingField";
import { readRememberedContact } from "../remembered-contact";
import { useBookingValidation } from "../useBookingValidation";

export function MyRequestsPage() {
  const [linkToken, setLinkToken] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "",
  );
  const [savedContact] = useState(readRememberedContact);
  const [contact, setContact] = useState(savedContact?.value ?? "");
  const { fieldErrors, handleBlur, handleChange, validate, resetValidation } =
    useBookingValidation();
  const [method, setMethod] = useState<ContactMethod>(savedContact?.method ?? "email");
  const contactName = method === "email" ? "email" : "whatsappNumber";
  const handleMethodChange = useCallback(
    (value: ContactMethod) => {
      setMethod(value);
      setContact(savedContact?.method === value ? savedContact.value : "");
      resetValidation();
      setNotice("");
      setError("");
    },
    [resetValidation, savedContact],
  );
  const handleContactChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setContact(event.target.value),
    [],
  );
  const [history, setHistory] = useState<RequestHistory>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    function readIncomingLink() {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
      if (!token) return;
      window.history.replaceState(null, "", window.location.pathname);
      setHistory(undefined);
      setError("");
      setNotice("");
      setLinkToken(token);
    }
    window.addEventListener("hashchange", readIncomingLink);
    return () => window.removeEventListener("hashchange", readIncomingLink);
  }, []);

  useEffect(() => {
    if (linkToken) {
      window.history.replaceState(null, "", window.location.pathname);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    fetchRequestHistory()
      .then((result) => {
        if (active) setHistory(result);
      })
      .catch((failure) => {
        if (active && (!(failure instanceof ApiError) || failure.status !== 401))
          setError("We could not load your requests. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [linkToken]);

  useEffect(() => {
    if (!history) return;
    const timer = window.setTimeout(
      () => {
        setHistory(undefined);
        setError("Your private session has expired. Request a new private link.");
      },
      Math.max(0, history.expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [history]);

  async function sendLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !validate(event.currentTarget)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await requestHistoryLink(contact, method);
      setNotice(result.message);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "We could not send a private link.");
    } finally {
      setBusy(false);
    }
  }

  async function openLink() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await verifyHistoryLink(linkToken);
      setLinkToken("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "We could not open this link.");
      if (failure instanceof ApiError && failure.status === 401) setLinkToken("");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await closeRequestHistory();
      setHistory(undefined);
      setContact("");
      setNotice("Your private session is closed.");
      setError("");
    } catch {
      setError("We could not close your session. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="narrow-page history-page">
      <header className="booking-intro">
        <a className="booking-back" href="/" aria-label="Back to booking">
          ←
        </a>
        <h1>My requests</h1>
      </header>
      {error && <Message tone="error">{error}</Message>}
      {notice && <Message tone="success">{notice}</Message>}
      {loading && <Message tone="info">Checking your private session…</Message>}
      {!loading && linkToken && (
        <section className="status-card">
          <h2>Open your requests</h2>
          <p>This private link can be used once. Your session lasts 30 minutes.</p>
          <button
            className="button button-primary"
            type="button"
            disabled={busy}
            onClick={openLink}
          >
            {busy ? "Verifying link…" : "Open my requests"}
          </button>
        </section>
      )}
      {!loading && !linkToken && !history && (
        <section className="status-card">
          <p>Choose where to receive your private link.</p>
          <form
            className="stack-form"
            onSubmit={sendLink}
            onBlur={handleBlur}
            onChange={handleChange}
            noValidate
          >
            <ContactMethodChoice value={method} onChange={handleMethodChange} />
            <BookingField
              name={contactName}
              label={method === "email" ? "Email address" : "WhatsApp number"}
              required
              error={fieldErrors[contactName]}
            >
              <input
                key={method}
                id={`booking-${contactName}`}
                name={contactName}
                type={method === "email" ? "email" : "tel"}
                autoComplete={method === "email" ? "email" : "tel"}
                maxLength={method === "email" ? 254 : 20}
                value={contact}
                onChange={handleContactChange}
                required
                disabled={busy}
                aria-invalid={Boolean(fieldErrors[contactName])}
                aria-describedby={`booking-${contactName}-help`}
              />
            </BookingField>
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? "Sending link…" : "Send private link"}
            </button>
          </form>
        </section>
      )}
      {!loading && history && !linkToken && (
        <>
          <div className="history-heading">
            <p>
              Requests for <strong>{history.contact || history.email}</strong>
              <br />
              <span className="muted">
                Private access ends {formatDateTime(new Date(history.expiresAt).toISOString())}.
              </span>
            </p>
            <button className="text-button" type="button" disabled={busy} onClick={logout}>
              Close private session
            </button>
          </div>
          {history.bookings.length === 0 && !history.locationRequests?.length ? (
            <Message tone="info">No ride requests for this contact yet.</Message>
          ) : (
            <div className="history-list">
              {history.bookings.map((booking) => (
                <article className="history-card" key={booking.id}>
                  <div className="section-heading">
                    <h2>{booking.reference}</h2>
                    <span className="status-pill">{statusLabel(booking.status)}</span>
                  </div>
                  <p>
                    {booking.origin.name} → {booking.destination.name}
                  </p>
                  <dl className="detail-list">
                    <div>
                      <dt>Pickup</dt>
                      <dd>{formatDateTime(booking.pickupAt)}</dd>
                    </div>
                    <FareDetails booking={booking} />
                  </dl>
                  {(booking.scheduleEvents ?? [])
                    .filter((event) => event.fromPickupAt !== event.toPickupAt)
                    .slice(-1)
                    .map((event) => (
                      <p key={event.id}>Rescheduled by the admin: {event.reason}</p>
                    ))}
                  {booking.rejectionReason && <p>Reason: {booking.rejectionReason}</p>}
                  <a
                    className="button button-secondary"
                    href={`/status/${encodeURIComponent(booking.accessToken)}`}
                  >
                    View request details
                  </a>
                </article>
              ))}
            </div>
          )}
          {history.locationRequests?.map((request) => (
            <article className="history-card" key={request.id}>
              <div className="section-heading">
                <h2>
                  {request.trip
                    ? `${request.trip.origin} → ${request.trip.destination}`
                    : request.locationName}
                </h2>
                <span className="status-pill">{statusLabel(request.status)}</span>
              </div>
              {request.trip && <p>{formatDateTime(request.trip.pickupAt)}</p>}
              <LocationPins trip={request.trip} />
              <p>
                {request.status === "pending"
                  ? "Route awaiting admin review. Fare and ride need confirmation."
                  : request.responseNote ||
                    "Location review complete. Contact the admin to confirm your ride and fare."}
              </p>
            </article>
          ))}
          <p>
            <a className="button button-primary" href="/">
              Request a ride
            </a>
          </p>
        </>
      )}
    </main>
  );
}
