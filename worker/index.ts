import type { Environment } from "./environment.js";
export { BookingStore } from "./booking-store.js";

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const headers = new Headers(request.headers);
    headers.set("x-forwarded-for", request.headers.get("cf-connecting-ip") ?? "unknown");
    return env.BOOKINGS.getByName("asa-ride-production").fetch(new Request(request, { headers }));
  },

  async scheduled(_event, env): Promise<void> {
    await env.BOOKINGS.getByName("asa-ride-production").maintain();
  },
} satisfies ExportedHandler<Environment>;
