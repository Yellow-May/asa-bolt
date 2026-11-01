import { DurableObject } from "cloudflare:workers";
import { Database } from "../server/infrastructure/database.js";
import { createRequestHandler, type RequestHandler } from "../server/routes/http.js";
import { CloudflareSqlDriver } from "./sql-driver.js";
import { serverEnvironment, type Environment } from "./environment.js";
import { handleNodeRequest } from "./node-request.js";

export class BookingStore extends DurableObject<Environment> {
  private readonly handler: RequestHandler;

  constructor(ctx: DurableObjectState, env: Environment) {
    super(ctx, env);
    this.handler = createRequestHandler({
      database: new Database("cloudflare:asa-ride", new CloudflareSqlDriver(ctx.storage)),
      env: serverEnvironment(env),
    });
  }

  async fetch(request: Request): Promise<Response> {
    const response = await handleNodeRequest(request, this.handler);
    this.ctx.waitUntil(this.handler.maintain());
    return response;
  }

  async maintain(): Promise<void> {
    await this.handler.maintain();
  }
}
