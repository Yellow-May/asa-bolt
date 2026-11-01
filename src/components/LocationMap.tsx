import { useEffect, useRef } from "react";
import { map as createMap, tileLayer, type LeafletMouseEvent } from "leaflet";
import { MAP_CONFIG } from "../../shared/config";
import type { MapPoint } from "../../shared/contracts";
import "leaflet/dist/leaflet.css";
import "../map.css";

interface LocationMapProps {
  center: MapPoint;
  onMove: (point: MapPoint) => void;
  onLoadStatus: (ready: boolean) => void;
}

export function LocationMap({ center, onMove, onLoadStatus }: LocationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const map = createMap(container.current, {
      center: [center.latitude, center.longitude],
      zoom: MAP_CONFIG.zoom,
      scrollWheelZoom: false,
    });
    const layer = tileLayer(MAP_CONFIG.tileUrl, {
      maxZoom: 19,
      referrerPolicy: "strict-origin-when-cross-origin",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);
    const handleMove = () => {
      const point = map.getCenter().wrap();
      onMove({ latitude: Number(point.lat.toFixed(6)), longitude: Number(point.lng.toFixed(6)) });
    };
    const handleClick = (event: LeafletMouseEvent) => map.panTo(event.latlng, { animate: false });
    const handleError = () => onLoadStatus(false);
    const handleTileLoad = () => onLoadStatus(true);
    map.on("moveend", handleMove);
    map.on("click", handleClick);
    layer.on("tileerror", handleError);
    layer.on("tileload", handleTileLoad);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      map.remove();
    };
  }, [center, onMove, onLoadStatus]);

  return (
    <>
      <div className="location-map-wrap">
        <div
          className="location-map"
          ref={container}
          aria-label="Location map. Use arrow keys to move and plus or minus to zoom."
        />
        <span className="location-map-pin" aria-hidden="true" />
      </div>
    </>
  );
}
