import roadPrices from "../data/eastern-road-distances.json" with { type: "json" };
import { createHash } from "node:crypto";
import type { ApplicationDatabase as Database } from "./database.js";

const sourceText = JSON.stringify(roadPrices);
const source = roadPrices as {
  id: string;
  approvedDefaultRatePerKm: string;
  routes: { id: string; distanceKm: string; calculatedAt: string }[];
};

export function importEasternRoadPrices(database: Database): void {
  const db = database.connection;
  if (db.prepare("SELECT id FROM research_imports WHERE id=?").get(source.id)) return;
  return database.transaction(() => {
    for (const route of source.routes)
      db.prepare(
        "UPDATE service_routes SET distance_km=?, source_label=?, distance_note=?, updated_at=? WHERE id=? AND distance_km IS NULL",
      ).run(
        route.distanceKm,
        "OpenRouteService driving-car · OpenStreetMap",
        "Road distance between OpenStreetMap town-centre pins; source retained.",
        route.calculatedAt,
        route.id,
      );
    db.prepare(
      "UPDATE pricing_settings SET default_rate_per_km=?, updated_at=? WHERE id=1 AND default_rate_per_km IS NULL",
    ).run(source.approvedDefaultRatePerKm, new Date().toISOString());
    db.exec(
      "UPDATE service_routes SET published=1 WHERE (id LIKE 'eastern-%' OR source_pair_key != '') AND CAST(distance_km AS REAL) > 0; UPDATE service_locations SET published=1 WHERE id IN (SELECT origin_id FROM service_routes WHERE published=1 UNION SELECT destination_id FROM service_routes WHERE published=1);",
    );
    db.prepare(
      "INSERT INTO research_imports (id, source_sha256, imported_at) VALUES (?, ?, ?)",
    ).run(
      source.id,
      createHash("sha256").update(sourceText).digest("hex"),
      new Date().toISOString(),
    );
  });
}
