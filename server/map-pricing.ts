import { randomUUID } from "node:crypto";
import type {
  FarePreview,
  MapPoint,
  RoadDistance,
  RoutePricePreview,
  ServiceRoute,
} from "../shared/contracts.js";
import { parseCoordinates } from "../shared/map-points.js";
import { localPickupParts } from "../shared/scheduling.js";
import type { ApplicationDatabase as Database } from "./infrastructure/database.js";
import type { Repository } from "./infrastructure/repository.js";
import type { PricingService } from "./pricing.js";
import type { RoadRouting } from "./road-routing.js";
import { optionalMapPoint } from "./domain/map-point.js";
import { nairaToKobo, roundNairaUpTo50 } from "./domain/pricing.js";
import { HttpError } from "./errors.js";

interface Direction {
  originId: string;
  destinationId: string;
  date: string;
  route?: ServiceRoute;
}

export class MapPricing {
  constructor(
    private readonly dependencies: {
      database: Database;
      repository: Repository;
      pricing: PricingService;
      routing: RoadRouting;
    },
  ) {}

  async distance(value: unknown): Promise<RoadDistance> {
    const body = record(value);
    const origin = this.publicPoint(body.originId, body.originPin);
    const destination = this.publicPoint(body.destinationId, body.destinationPin);
    if (
      typeof body.originId === "string" &&
      typeof body.destinationId === "string" &&
      !body.originPin &&
      !body.destinationPin
    ) {
      const route = this.dependencies.database.connection
        .prepare(
          "SELECT distance_km, updated_at FROM service_routes WHERE origin_id=? AND destination_id=? AND published=1",
        )
        .get(body.originId, body.destinationId);
      if (route?.distance_km)
        return {
          distanceKm: String(route.distance_km),
          provider: "catalogue",
          calculatedAt: String(route.updated_at),
        };
    }
    return this.dependencies.routing.distance(origin, destination);
  }

  async preview(value: unknown): Promise<RoutePricePreview> {
    const body = record(value),
      direction = this.direction(body);
    const previous = this.savedFare(direction);
    if (body.action !== "calculate" && previous)
      return { fare: previous, previousAmountKobo: previous.amountKobo, calculated: false };
    const distanceKm = await this.calculateDistance(direction);
    const fare = this.dependencies.pricing.preview({ ...direction, mode: "distance", distanceKm });
    return { fare, previousAmountKobo: previous?.amountKobo, calculated: true };
  }

  async save(value: unknown) {
    const body = record(value),
      direction = this.direction(body);
    const amount = requiredText(body.amountNaira, "price");
    const raw = nairaToKobo(amount),
      rounded = roundNairaUpTo50(amount);
    if (raw !== rounded) {
      const fare = this.dependencies.pricing.preview({
        ...direction,
        mode: "fixed",
        fixedAmountNaira: amount,
      });
      throw new HttpError(409, "Review the rounded price, then save.", { fare });
    }
    const mode =
      body.priceMode === "calculated"
        ? "calculated"
        : body.priceMode === "manual"
          ? "manual"
          : "existing";
    const previous = this.savedFare(direction);
    if (mode === "existing" && previous && previous.amountKobo !== rounded)
      throw new HttpError(409, "The price changed. Review it, then save.", { fare: previous });
    const distanceKm =
      mode === "calculated" ? await this.calculateDistance(direction) : direction.route?.distanceKm;
    if (mode === "calculated") {
      const fare = this.dependencies.pricing.preview({
        ...direction,
        mode: "distance",
        distanceKm,
      });
      if (fare.amountKobo !== rounded)
        throw new HttpError(409, "The calculated price changed. Review it, then save.", { fare });
    }
    return this.persist({ direction, amount, mode, distanceKm });
  }

  private persist(input: {
    direction: Direction;
    amount: string;
    mode: string;
    distanceKm?: string | null;
  }) {
    const { direction, amount, mode, distanceKm } = input;
    const { database, repository, pricing } = this.dependencies;
    return database.transaction(() => {
      const route = pricing.saveRoute(direction.route?.id ?? "new", {
        originId: direction.originId,
        destinationId: direction.destinationId,
        distanceKm: distanceKm ?? null,
        published: true,
        distanceNote:
          mode === "calculated"
            ? "OpenRouteService road distance."
            : (direction.route?.distanceNote ?? "Admin-set route price."),
        pricingAreaId: direction.route?.pricingAreaId ?? null,
      });
      if (mode === "calculated") {
        for (const rule of repository.listFares())
          if (
            rule.active &&
            rule.originId === direction.originId &&
            rule.destinationId === direction.destinationId &&
            rule.effectiveFrom <= direction.date
          )
            repository.saveFare({ ...rule, active: false });
      } else if (mode === "manual" || !this.savedFare(direction)) {
        repository.saveFare({
          id: randomUUID(),
          originId: direction.originId,
          destinationId: direction.destinationId,
          amountKobo: nairaToKobo(amount),
          currency: "NGN",
          effectiveFrom: direction.date,
          active: true,
        });
      }
      const fare = pricing.preview(direction);

      return { route, fare };
    });
  }

  private direction(body: Record<string, unknown>): Direction {
    const originId = requiredText(body.originId, "pickup"),
      destinationId = requiredText(body.destinationId, "destination");
    this.dependencies.repository.getLocation(originId);
    this.dependencies.repository.getLocation(destinationId);
    if (originId === destinationId) throw new HttpError(400, "Choose two different locations.");
    const route = this.dependencies.pricing
      .routes()
      .find((item) => item.originId === originId && item.destinationId === destinationId);
    return {
      originId,
      destinationId,
      route,
      date: localPickupParts(new Date().toISOString()).date,
    };
  }

  private savedFare(direction: Direction): FarePreview | undefined {
    try {
      return this.dependencies.pricing.preview(direction);
    } catch (failure) {
      if (!(failure instanceof HttpError && failure.status === 400)) throw failure;
    }
  }

  private async calculateDistance(direction: Direction): Promise<string> {
    const origin = parseCoordinates(
      this.dependencies.repository.getLocation(direction.originId).coordinates,
    );
    const destination = parseCoordinates(
      this.dependencies.repository.getLocation(direction.destinationId).coordinates,
    );
    if (origin && destination)
      return (await this.dependencies.routing.distance(origin, destination)).distanceKm;
    if (direction.route?.distanceKm) return direction.route.distanceKm;
    throw new HttpError(
      400,
      "Add map pins to these locations before generating a price, or enter the price yourself.",
    );
  }

  private publicPoint(id: unknown, pin: unknown): MapPoint {
    if (pin !== undefined) return requiredPoint(pin);
    const location = this.dependencies.repository.getLocation(requiredText(id, "location"));
    if (!location.published) throw new HttpError(400, "Choose a published location.");
    return requiredPoint(parseCoordinates(location.coordinates));
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "Complete the route details.");
  return value as Record<string, unknown>;
}
function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 120)
    throw new HttpError(400, `Enter a valid ${label}.`);
  return value.trim();
}
function requiredPoint(value: unknown): MapPoint {
  const point = optionalMapPoint(value);
  if (
    !point ||
    point.latitude < 4 ||
    point.latitude > 14 ||
    point.longitude < 2 ||
    point.longitude > 15
  )
    throw new HttpError(400, "Choose a map pin within Nigeria.");
  return point;
}
