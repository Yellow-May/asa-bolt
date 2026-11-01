import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ServiceLocation } from "../../shared/contracts";

export function LocationOrder({
  locations,
  busy,
  onReverse,
}: {
  locations: [ServiceLocation, ServiceLocation];
  busy: boolean;
  onReverse: () => void;
}) {
  const dragStartY = useRef<number | undefined>(undefined);
  const [dragging, setDragging] = useState("");
  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (!busy && ["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        onReverse();
      }
    },
    [busy, onReverse],
  );
  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (busy) return;
      event.preventDefault();
      dragStartY.current = event.clientY;
      setDragging(event.currentTarget.dataset.id ?? "");
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [busy],
  );
  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const movement = dragStartY.current === undefined ? 0 : event.clientY - dragStartY.current;
      if (!busy && Math.abs(movement) > 24) onReverse();
      dragStartY.current = undefined;
      setDragging("");
    },
    [busy, onReverse],
  );
  const handlePointerCancel = useCallback(() => {
    dragStartY.current = undefined;
    setDragging("");
  }, []);
  return (
    <ol className="route-location-order" aria-label="Route direction">
      {locations.map((location, index) => (
        <li
          key={location.id}
          data-id={location.id}
          className={dragging === location.id ? "is-dragging" : ""}
        >
          <span>{index === 0 ? "From" : "To"}</span>
          <strong>{location.name}</strong>
          <button
            type="button"
            className="route-drag-handle"
            data-id={location.id}
            onKeyDown={handleKey}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            disabled={busy}
            aria-label={`Move ${location.name} ${index === 0 ? "to destination" : "to start"}; drag or use arrow keys`}
          >
            ⠿
          </button>
        </li>
      ))}
    </ol>
  );
}
