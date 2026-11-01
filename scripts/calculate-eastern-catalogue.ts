import { mkdir, writeFile } from "node:fs/promises";
import { Database } from "../server/infrastructure/database.js";
import { Repository } from "../server/infrastructure/repository.js";
import { importEasternRoadPrices } from "../server/infrastructure/eastern-road-prices.js";
import { importRouteResearch } from "../server/infrastructure/research.js";
import { seedDatabase } from "../server/infrastructure/seed.js";
import { EasternCatalogue, importEasternCatalogue } from "../server/eastern-catalogue.js";
import { PricingService } from "../server/pricing.js";
import { RoadRouting } from "../server/road-routing.js";
import { snapshotDatabase } from "../server/backup.js";
import { resolve } from "node:path";

const operation = process.argv[2] ?? "preview";
if (!["preview", "activate"].includes(operation)) throw new Error("Use preview or activate.");
const path = process.env.ASA_BOLT_DATABASE_PATH ?? "./data/asa-bolt.sqlite";
if (operation === "activate") {
  await mkdir("./backups", { recursive: true, mode: 0o700 });
  await snapshotDatabase(path, resolve(`./backups/before-eastern-catalogue-${Date.now()}.sqlite`));
}
const database = new Database(path);
try {
  seedDatabase(database);
  importRouteResearch(database);
  importEasternCatalogue(database);
  importEasternRoadPrices(database);
  const repository = new Repository(database);
  const pricing = new PricingService(database, repository);
  const routing = new RoadRouting(database, process.env);
  const catalogue = new EasternCatalogue(database, repository, { routing, pricing });
  const defaultRate = process.argv.find((value) => value.startsWith("--default-rate="))?.slice(15);
  if (operation === "activate" && defaultRate) pricing.saveSettings(defaultRate);
  const result =
    operation === "activate" ? await catalogue.calculateAndActivate() : catalogue.overview();
  const summary = {
    operation,
    calculatedAt: new Date().toISOString(),
    ...result,
    defaultRatePerKm: pricing.settings().defaultRatePerKm,
    ...database.connection
      .prepare("SELECT COUNT(*) AS routes, SUM(published) AS activeRoutes FROM service_routes")
      .get(),
  };
  if (operation === "activate") {
    await mkdir("./outputs/eastern-catalogue", { recursive: true });
    await writeFile(
      "./outputs/eastern-catalogue/summary.json",
      JSON.stringify(summary, null, 2) + "\n",
    );
  }
  console.log(JSON.stringify(summary));
} finally {
  database.close();
}
