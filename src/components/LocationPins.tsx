import type { LocationRequestTrip } from "../../shared/contracts";

export function LocationPins({ trip }: { trip?: LocationRequestTrip }) {
  return (
    <div className="action-row">
      {(["originPin", "destinationPin"] as const).map((key) => {
        const point = trip?.[key];
        return (
          point && (
            <a
              key={key}
              href={`https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=17/${point.latitude}/${point.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              {key === "originPin" ? "Pickup pin" : "Destination pin"} ↗
            </a>
          )
        );
      })}
    </div>
  );
}
