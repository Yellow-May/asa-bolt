import { readFileSync } from "node:fs";
import type { Database } from "./infrastructure/database.js";
import type { Repository } from "./infrastructure/repository.js";
import type { PricingService } from "./pricing.js";
import { localPickupParts } from "../shared/scheduling.js";
import type { MapPoint, ServiceLocation } from "../shared/contracts.js";
import type { RoadRouting } from "./road-routing.js";
import { formatCoordinates, parseCoordinates, pointMapUrl } from "../shared/map-points.js";
import { HttpError } from "./errors.js";

interface CatalogueEntry {
  location: ServiceLocation;
  point: MapPoint;
}

const source = JSON.parse(
  readFileSync(new URL("./data/eastern-locations.json", import.meta.url), "utf8"),
) as {
  id: string;
  collectedAt: string;
  locations: {
    osmId: number;
    name: string;
    latitude: number;
    longitude: number;
    sourceUrl: string;
  }[];
};

export function importEasternCatalogue(database: Database): void {
  const db = database.connection;
  if (db.prepare("SELECT id FROM research_imports WHERE id = ?").get(source.id)) return;
  db.exec("BEGIN IMMEDIATE");
  try {
    const entries = source.locations.map((item) => {
      const old = db
        .prepare(
          "SELECT id FROM service_locations WHERE lower(trim(name)) = lower(?) ORDER BY created_at, id LIMIT 1",
        )
        .get(item.name);
      const id = old ? String(old.id) : `osm-node-${item.osmId}`;
      db.prepare(
        "INSERT OR IGNORE INTO service_locations (id, name, landmark, maps_url, coordinates, published, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
      ).run(
        id,
        item.name,
        "South-East Nigeria · town centre",
        pointMapUrl(item),
        formatCoordinates(item),
        new Date().toISOString(),
      );
      db.prepare(
        "UPDATE service_locations SET coordinates = ? WHERE id = ? AND coordinates = ''",
      ).run(formatCoordinates(item), id);
      return { id, item };
    });
    for (const origin of entries)
      for (const destination of entries) {
        if (origin.id === destination.id) continue;
        db.prepare(
          "INSERT OR IGNORE INTO service_routes (id, origin_id, destination_id, published, source_url, source_label, collected_at, distance_note, updated_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)",
        ).run(
          `eastern-${origin.item.osmId}-${destination.item.osmId}`,
          origin.id,
          destination.id,
          origin.item.sourceUrl,
          "OpenStreetMap town centres; road distance pending",
          source.collectedAt,
          "Draft. Road distance and service coverage need admin review.",
          new Date().toISOString(),
        );
      }
    db.prepare(
      "INSERT INTO research_imports (id, source_sha256, imported_at) VALUES (?, ?, ?)",
    ).run(source.id, "public-osm-node-centres", new Date().toISOString());
    db.exec("COMMIT");
  } catch (failure) {
    db.exec("ROLLBACK");
    throw failure;
  }
}

export class EasternCatalogue {
  private busy = false;
  constructor(
    private readonly database: Database,
    private readonly repository: Repository,
    private readonly services: { routing: RoadRouting; pricing: PricingService },
  ) {}

  overview() {
    const entries = this.entries();
    return {
      locations: entries.length,
      possibleRoutes: entries.length * (entries.length - 1),
      configured: this.services.routing.configured(),
      source: "OpenStreetMap town centres",
      collectedAt: source.collectedAt,
    };
  }

  async calculateAndActivate() {
    if (this.busy)
      throw new HttpError(
        409,
        "Catalogue distances are already being calculated. Refresh shortly.",
      );
    this.busy = true;
    try {
      const entries = this.entries();
      if (entries.length < 2) throw new HttpError(400, "Add map pins for at least two locations.");
      const matrix = await this.services.routing.matrix(entries.map((item) => item.point));
      return this.saveMatrix(entries, matrix);
    } finally {
      this.busy = false;
    }
  }

  private entries(): CatalogueEntry[] {
    const locations = this.repository.listLocations();
    return source.locations.flatMap((item) => {
      const location = locations.find(
        (entry) =>
          entry.id === `osm-node-${item.osmId}` ||
          entry.name.toLocaleLowerCase() === item.name.toLocaleLowerCase(),
      );
      const point = location && parseCoordinates(location.coordinates);
      return location && point ? [{ location, point }] : [];
    });
  }

  private saveMatrix(entries: CatalogueEntry[], matrix: (number | null)[][]) {
    const db = this.database.connection;
    let updated = 0,
      preserved = 0,
      unavailable = 0;
    db.exec("BEGIN IMMEDIATE");
    try {
      entries.forEach((origin, i) =>
        entries.forEach((destination, j) => {
          if (i === j) return;
          const meters = matrix[i]?.[j];
          if (!meters || meters > 1_500_000) {
            unavailable += 1;
            return;
          }
          this.services.routing.saveDistance(origin.point, destination.point, meters);
          const row = db
            .prepare(
              "UPDATE service_routes SET distance_km=?, source_label=?, distance_note=?, updated_at=? WHERE origin_id=? AND destination_id=? AND distance_km IS NULL AND published=0 RETURNING id",
            )
            .get(
              (meters / 1000).toFixed(3),
              "OpenRouteService driving-car · OpenStreetMap",
              "Road distance between saved map pins. Review service coverage before publishing.",
              new Date().toISOString(),
              origin.location.id,
              destination.location.id,
            );
          if (row) updated += 1;
          else preserved += 1;
        }),
      );
      const published = this.activatePricedRoutes();
      db.exec("COMMIT");
      return { updated, preserved, unavailable, published };
    } catch (failure) {
      db.exec("ROLLBACK");
      throw failure;
    }
  }
  private activatePricedRoutes(): number {
    const { date } = localPickupParts(new Date().toISOString());
    const db = this.database.connection;
    const routes = db
      .prepare(
        "SELECT id, origin_id, destination_id FROM service_routes WHERE published=0 AND (id LIKE 'eastern-%' OR source_pair_key != '')",
      )
      .all();
    let activated = 0;
    for (const route of routes) {
      try {
        this.services.pricing.preview({
          originId: String(route.origin_id),
          destinationId: String(route.destination_id),
          date,
        });
      } catch (failure) {
        if (failure instanceof HttpError && failure.status === 400) continue;
        throw failure;
      }
      db.prepare("UPDATE service_routes SET published=1 WHERE id=?").run(String(route.id));
      db.prepare("UPDATE service_locations SET published=1 WHERE id IN (?, ?)").run(
        String(route.origin_id),
        String(route.destination_id),
      );
      activated += 1;
    }
    return activated;
  }
}
