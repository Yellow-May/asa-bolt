import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiFetch } from "../api";
import { ConfirmationDialog } from "./ConfirmationDialog";

interface CatalogueOverview {
  locations: number;
  possibleRoutes: number;
  configured: boolean;
}

export function EasternCataloguePanel({
  token,
  onSaved,
}: {
  token: string;
  onSaved: () => Promise<void>;
}) {
  const [overview, setOverview] = useState<CatalogueOverview>();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    apiFetch<CatalogueOverview>("/owner/eastern-catalogue", {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(setOverview)
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Could not load the South-East catalogue. Refresh the page.");
      });
    return () => controller.abort();
  }, [token]);
  const handleOpen = useCallback(() => {
    setOpen(true);
    setError("");
  }, []);
  const handleClose = useCallback(() => setOpen(false), []);
  const handleCalculate = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await apiFetch<{
        updated: number;
        preserved: number;
        unavailable: number;
        published: number;
      }>("/owner/eastern-catalogue", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { publish: true },
      });
      await onSaved();
      setNotice(
        `${result.updated} road distances saved · ${result.published} routes activated · ${result.preserved} existing routes preserved · ${result.unavailable} unavailable.`,
      );
      setOpen(false);
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : "Could not calculate catalogue distances. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [onSaved, token]);
  return (
    <section className="eastern-catalogue-panel" aria-label="South-East catalogue">
      <div>
        <strong>South-East route prices</strong>
        <p className="field-help">
          {overview
            ? `${overview.locations} mapped centres · up to ${overview.possibleRoutes.toLocaleString()} directions`
            : "Loading catalogue…"}
        </p>
      </div>
      <button
        className="button button-secondary"
        type="button"
        onClick={handleOpen}
        disabled={busy}
      >
        Calculate & activate routes
      </button>
      {notice && (
        <p role="status" className="field-help">
          {notice}
        </p>
      )}
      {!open && error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <ConfirmationDialog
        open={open}
        title="Calculate South-East route prices?"
        description="Calculate road distances and activate routes with usable prices under your current rates. Existing distances and fixed prices stay in place."
        busy={busy}
        error={error}
        onClose={handleClose}
        footer={
          <button
            type="button"
            className="button button-primary"
            onClick={handleCalculate}
            disabled={busy}
          >
            {busy ? "Calculating…" : "Calculate & activate"}
          </button>
        }
      >
        <p>
          OpenRouteService calculates each direction separately. Unreachable or unpriced routes
          remain unavailable.
        </p>
      </ConfirmationDialog>
    </section>
  );
}
