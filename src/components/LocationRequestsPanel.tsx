import type { LocationRequest } from "../../shared/contracts";
import { useCallback, useState, type MouseEvent } from "react";
import { formatDateTime, statusLabel } from "../format";
import { LocationPins } from "./LocationPins";
import { Message } from "./Message";
import { ConfirmationDialog } from "./ConfirmationDialog";

export function LocationRequestsPanel({
  requests,
  onReview,
}: {
  requests: LocationRequest[];
  onReview: (event: MouseEvent<HTMLButtonElement>) => Promise<void>;
}) {
  const [decision, setDecision] = useState<{ id: string; status: "approved" | "declined" }>();
  const [busy, setBusy] = useState(false);
  const handleStart = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    setDecision({
      id: event.currentTarget.dataset.id ?? "",
      status: event.currentTarget.dataset.status === "approved" ? "approved" : "declined",
    });
  }, []);
  const handleClose = useCallback(() => setDecision(undefined), []);
  const handleConfirm = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      if (busy) return;
      setBusy(true);
      try {
        await onReview(event);
      } finally {
        setBusy(false);
        setDecision(undefined);
      }
    },
    [busy, onReview],
  );
  return (
    <section className="owner-content">
      <div className="section-heading">
        <h2>Route reviews</h2>
      </div>
      {requests.length === 0 ? (
        <Message tone="info">No routes awaiting review.</Message>
      ) : (
        <div className="booking-table">
          {requests.map((request) => (
            <article className="booking-row" key={request.id}>
              <div className="booking-row-main">
                <span className="reference-small">{statusLabel(request.status)}</span>
                <strong>{request.locationName}</strong>
                <span className="muted">
                  {[request.landmark, request.requesterName, request.email || request.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {request.trip && (
                  <>
                    <strong>
                      {request.trip.origin} → {request.trip.destination}
                    </strong>
                    <span>{formatDateTime(request.trip.pickupAt)}</span>
                    {request.trip.pickupNote && <span>{request.trip.pickupNote}</span>}
                    <span className="muted">
                      Route review only. Fare and ride need confirmation.
                    </span>
                    <LocationPins trip={request.trip} />
                  </>
                )}
              </div>
              {request.status === "pending" && (
                <div className="action-row compact">
                  <button
                    className="button button-primary"
                    data-id={request.id}
                    data-status="approved"
                    type="button"
                    onClick={handleStart}
                  >
                    {request.trip
                      ? request.trip.customLocations?.length
                        ? "Approve locations"
                        : "Mark reviewed"
                      : "Approve & publish"}
                  </button>
                  <button
                    className="button button-danger"
                    data-id={request.id}
                    data-status="declined"
                    type="button"
                    onClick={handleStart}
                  >
                    Decline
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <ConfirmationDialog
        open={Boolean(decision)}
        title={
          decision?.status === "declined"
            ? "Decline this route request?"
            : "Approve this route review?"
        }
        description="This reviews the requested locations. The fare and ride need separate confirmation."
        busy={busy}
        onClose={handleClose}
        footer={
          <button
            className={`button ${decision?.status === "declined" ? "button-danger" : "button-primary"}`}
            type="button"
            data-id={decision?.id}
            data-status={decision?.status}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy
              ? "Saving…"
              : decision?.status === "declined"
                ? "Decline request"
                : "Confirm review"}
          </button>
        }
      />
    </section>
  );
}
