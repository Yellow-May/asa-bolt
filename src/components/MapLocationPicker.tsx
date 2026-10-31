import { lazy, Suspense, useCallback, useState } from "react";
import type { MapPoint } from "../../shared/contracts";
import { MAP_CONFIG } from "../../shared/config";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { MapUnavailable } from "./MapUnavailable";

const LocationMap = lazy(() =>
  import("./LocationMap")
    .then((module) => ({ default: module.LocationMap }))
    .catch(() => ({ default: MapUnavailable })),
);

interface MapLocationPickerProps {
  label: string;
  point?: MapPoint;
  onChoose: (point: MapPoint) => void;
}

export function MapLocationPicker({ label, point, onChoose }: MapLocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [center, setCenter] = useState<MapPoint>(MAP_CONFIG.center);
  const [draft, setDraft] = useState<MapPoint>(MAP_CONFIG.center);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const handleOpen = useCallback(() => {
    setCenter(point ?? MAP_CONFIG.center);
    setDraft(point ?? MAP_CONFIG.center);
    setReady(false);
    setError("");
    setOpen(true);
  }, [point]);
  const handleClose = useCallback(() => setOpen(false), []);
  const handleMove = useCallback((value: MapPoint) => setDraft(value), []);
  const handleLoadStatus = useCallback((loaded: boolean) => {
    setReady(loaded);
    setError(loaded ? "" : "The map could not load. Go back and enter the location instead.");
  }, []);
  const handleConfirm = useCallback(() => {
    if (!ready) {
      setError("Wait for the map to load, or go back and enter the location instead.");
      return;
    }
    onChoose(draft);
    setOpen(false);
  }, [draft, onChoose, ready]);

  return (
    <>
      <button className="text-button map-picker-button" type="button" onClick={handleOpen}>
        {point ? "Change map pin" : "Choose on map"}
      </button>
      <ConfirmationDialog
        open={open}
        title={`Choose ${label.toLowerCase()}`}
        description="Move the map to place the pin, then confirm."
        error={error}
        onClose={handleClose}
        footer={
          <button className="button button-primary" type="button" onClick={handleConfirm}>
            Use this location
          </button>
        }
      >
        {open && (
          <Suspense fallback={<p role="status">Loading map…</p>}>
            <LocationMap center={center} onMove={handleMove} onLoadStatus={handleLoadStatus} />
          </Suspense>
        )}
      </ConfirmationDialog>
    </>
  );
}
