import { handleAsNodeRequest } from "cloudflare:node";
import { createServer } from "node:http";
import type { RequestHandler } from "../server/routes/http.js";

export async function handleNodeRequest(
  request: Request,
  handler: RequestHandler,
): Promise<Response> {
  const server = createServer(handler);
  server.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("API bridge failed to start.");
    return await handleAsNodeRequest(address.port, request);
  } finally {
    server.close();
  }
}
