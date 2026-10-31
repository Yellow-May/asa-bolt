import type { LocationRequest } from "../../shared/contracts";
import { formatDateTime } from "../format";
import { LocationPins } from "./LocationPins";

interface LocationReviewSummaryProps {
  request: LocationRequest;
  onNewBooking: () => void;
}

export function LocationReviewSummary({ request, onNewBooking }: LocationReviewSummaryProps) {
  return (
    <main className="narrow-page">
      <section className="confirmation-card">
        <h1>Sent for review</h1>
        <p>Your route is with the admin. The fare and ride still need confirmation.</p>
        {request.trip && (
          <dl className="detail-list">
            <div>
              <dt>Route</dt>
              <dd>
                {request.trip.origin} → {request.trip.destination}
              </dd>
            </div>
            <div>
              <dt>Pickup</dt>
              <dd>{formatDateTime(request.trip.pickupAt)}</dd>
            </div>
            {request.trip.pickupNote && (
              <div>
                <dt>Pickup note</dt>
                <dd>{request.trip.pickupNote}</dd>
              </div>
            )}
            <div>
              <dt>Contact</dt>
              <dd>{request.email || request.phone}</dd>
            </div>
          </dl>
        )}
        <LocationPins trip={request.trip} />
        <div className="action-row">
          <a className="button button-primary" href="/my-requests">
            My requests
          </a>
          <button className="text-button" type="button" onClick={onNewBooking}>
            Request another ride
          </button>
        </div>
      </section>
    </main>
  );
}
