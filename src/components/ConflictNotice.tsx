import { ConfirmationDialog } from "./ConfirmationDialog";
import { useCallback, useState } from "react";
import type { ConflictReview } from "../../shared/contracts";
import { formatDateTime } from "../format";

export function ConflictNotice({
  review,
  busy,
  action,
  onConfirm,
  onCancel,
  error,
}: {
  review: ConflictReview;
  busy: boolean;
  action: string;
  onConfirm: () => void;
  onCancel: () => void;
  error?: string;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [validationError, setError] = useState("");
  const handleConfirm = useCallback(() => {
    if (!acknowledged) {
      setError("Review the conflicts and tick the acknowledgement before continuing.");
      return;
    }
    onConfirm();
  }, [acknowledged, onConfirm]);
  const handleAcknowledgement = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setAcknowledged(event.target.checked);
    setError("");
  }, []);
  return (
    <ConfirmationDialog
      open
      title="Possible scheduling conflict"
      description="Other accepted or in-progress rides share this pickup date in Africa/Lagos. Durations are not estimated, so these are possible conflicts. Review the times and decide whether you can accept this ride."
      busy={busy}
      error={error || validationError}
      onClose={onCancel}
      footer={
        <button
          type="button"
          className="button button-primary"
          disabled={busy}
          onClick={handleConfirm}
        >
          {busy ? "Saving…" : action}
        </button>
      }
    >
      <ul>
        {review.conflicts.map((conflict) => (
          <li key={conflict.id}>
            <strong>{conflict.reference}</strong> · {conflict.route}
            <br />
            {formatDateTime(conflict.pickupAt)}
            <br />
            <span>
              {conflict.kind === "same_pickup"
                ? "Same pickup time"
                : "Same pickup date; check availability"}
            </span>
          </li>
        ))}
      </ul>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={acknowledged}
          disabled={busy}
          onChange={handleAcknowledgement}
        />
        I have reviewed the possible conflicts and can accommodate the ride.
      </label>
    </ConfirmationDialog>
  );
}
