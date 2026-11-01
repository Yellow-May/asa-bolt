import { createHash } from "node:crypto";
import type { MapPoint, RoadDistance } from "../shared/contracts.js";
import { formatCoordinates } from "../shared/map-points.js";
import type { Database } from "./infrastructure/database.js";
import { HttpError } from "./errors.js";

const apiOrigin = "https://api.heigit.org/openrouteservice";
const cacheLifetime = 30 * 24 * 60 * 60 * 1000;

export class RoadRouting {
  private readonly apiKey: string;
  private active = 0;
  private nextRequestAt = 0;
  private readonly pending = new Map<string, Promise<RoadDistance>>();

  constructor(
    private readonly database: Database,
    env: NodeJS.ProcessEnv,
    private readonly transport = fetch,
  ) {
    this.apiKey = env.OPENROUTESERVICE_API_KEY?.trim() ?? "";
  }

  configured(): boolean {
    return Boolean(this.apiKey);
  }

  async distance(origin: MapPoint, destination: MapPoint): Promise<RoadDistance> {
    const key = this.cacheKey(origin, destination);
    const cached = this.database.connection
      .prepare("SELECT * FROM road_distance_cache WHERE id = ?")
      .get(key);
    if (cached && Date.parse(String(cached.calculated_at)) > Date.now() - cacheLifetime)
      return this.result(Number(cached.distance_meters), String(cached.calculated_at));
    const current = this.pending.get(key);
    if (current) return current;
    const request = this.fetchDistance(origin, destination).finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  async matrix(points: MapPoint[]): Promise<(number | null)[][]> {
    if (points.length < 2 || points.length > 50)
      throw new HttpError(400, "Choose between 2 and 50 pinned locations.");
    const data = await this.post("matrix/driving-car", {
      locations: points.map(tuple),
      metrics: ["distance"],
      units: "m",
      resolve_locations: false,
    });
    const matrix = data.distances;
    if (
      !Array.isArray(matrix) ||
      matrix.length !== points.length ||
      matrix.some((row) => !Array.isArray(row) || row.length !== points.length)
    )
      throw new HttpError(
        502,
        "The distance service returned an incomplete matrix. Try again later.",
      );
    return matrix.map((row: unknown[]) =>
      row.map((value) =>
        typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.ceil(value) : null,
      ),
    );
  }

  saveDistance(origin: MapPoint, destination: MapPoint, meters: number): RoadDistance {
    if (!Number.isFinite(meters) || meters <= 0 || meters > 1_500_000)
      throw new HttpError(400, "This road distance is unavailable.");
    const now = new Date().toISOString();
    this.database.connection
      .prepare(
        "INSERT INTO road_distance_cache (id, distance_meters, calculated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET distance_meters=excluded.distance_meters, calculated_at=excluded.calculated_at",
      )
      .run(this.cacheKey(origin, destination), Math.ceil(meters), now);
    return this.result(Math.ceil(meters), now);
  }

  private async fetchDistance(origin: MapPoint, destination: MapPoint): Promise<RoadDistance> {
    if (formatCoordinates(origin) === formatCoordinates(destination))
      throw new HttpError(400, "Choose two different map locations.");
    const data = await this.post("directions/driving-car/json", {
      coordinates: [tuple(origin), tuple(destination)],
      instructions: false,
      geometry: false,
      units: "m",
      radiuses: [500, 500],
    });
    const routes = data.routes as { summary?: { distance?: unknown } }[] | undefined;
    const meters = routes?.[0]?.summary?.distance;
    if (typeof meters !== "number")
      throw new HttpError(
        502,
        "A road route could not be calculated. Move the pins closer to a road.",
      );
    return this.saveDistance(origin, destination, meters);
  }

  private async post(path: string, body: unknown): Promise<Record<string, unknown>> {
    if (!this.apiKey)
      throw new HttpError(
        503,
        "Road-distance calculation is awaiting setup. You can still send this trip for review.",
      );
    if (this.active >= 4)
      throw new HttpError(429, "Distance calculation is busy. Try again shortly.");
    this.active += 1;
    const delay = Math.max(0, this.nextRequestAt - Date.now());
    this.nextRequestAt = Date.now() + delay + 2100;
    try {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      this.consumeBudget(path.startsWith("matrix") ? "matrix" : "directions");
      const response = await this.transport(`${apiOrigin}/v2/${path}`, {
        method: "POST",
        headers: { Authorization: this.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
        redirect: "error",
      });
      if (response.status === 429 || response.status === 403)
        throw new HttpError(
          429,
          "Road-distance service quota is unavailable. Try later or send the trip for review.",
        );
      if (response.status === 400 || response.status === 404)
        throw new HttpError(
          400,
          "No drivable route was found. Place both pins near accessible roads.",
        );
      if (!response.ok)
        throw new HttpError(
          502,
          "Road-distance calculation is temporarily unavailable. Try again later.",
        );
      return (await response.json()) as Record<string, unknown>;
    } catch (failure) {
      if (failure instanceof HttpError) throw failure;
      throw new HttpError(502, "Could not reach the road-distance service. Try again later.");
    } finally {
      this.active -= 1;
    }
  }

  private consumeBudget(kind: string): void {
    const now = Date.now();
    const key = createHash("sha256").update(`routing-budget:${kind}`).digest("hex");
    const row = this.database.connection
      .prepare(
        "INSERT INTO history_rate_limits (key_hash, attempts, resets_at) VALUES (?, 1, ?) ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN resets_at <= ? THEN 1 ELSE attempts+1 END, resets_at=CASE WHEN resets_at <= ? THEN excluded.resets_at ELSE resets_at END RETURNING attempts",
      )
      .get(key, now + 86_400_000, now, now);
    if (Number(row?.attempts) > (kind === "matrix" ? 100 : 1000))
      throw new HttpError(
        429,
        "Today's distance calculation allowance is used. Try again tomorrow.",
      );
  }

  private cacheKey(origin: MapPoint, destination: MapPoint): string {
    return createHash("sha256")
      .update(`ors:driving-car:${formatCoordinates(origin)}>${formatCoordinates(destination)}`)
      .digest("hex");
  }

  private result(meters: number, calculatedAt: string): RoadDistance {
    return { distanceKm: (meters / 1000).toFixed(3), provider: "openrouteservice", calculatedAt };
  }
}

function tuple(point: MapPoint): [number, number] {
  return [point.longitude, point.latitude];
}
