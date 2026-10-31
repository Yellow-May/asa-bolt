import { createHash, randomBytes } from "node:crypto";
import type { ContactMethod, RequestHistory } from "../shared/contracts.js";
import { contactIdentity, readContactIdentity } from "./domain/contact.js";
import { HttpError } from "./errors.js";
import type { Database } from "./infrastructure/database.js";
import type { CustomerEmail } from "./infrastructure/notifications/email.js";
import type { Repository } from "./infrastructure/repository.js";

const LINK_LIFETIME = 15 * 60_000;
export const HISTORY_SESSION_SECONDS = 30 * 60;
export const HISTORY_COOKIE = "asa_ride_history";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export class HistoryAccess {
  constructor(
    private readonly database: Database,
    private readonly repository: Repository,
    private readonly email: CustomerEmail,
    private readonly whatsapp?: CustomerEmail,
  ) {}

  limitBooking(value: string, ip: string, method: ContactMethod = "email"): void {
    this.limit(`booking-ip:${ip}`, 50);
    this.limit(`booking-contact:${contactIdentity(method, value)}`, 10);
  }

  async requestLink(value: string, ip: string, method: ContactMethod = "email"): Promise<void> {
    const email = contactIdentity(method, value);
    this.limit(`ip:${ip}`, 20);
    this.limit(`email:${email}`, 3);
    this.cleanup();
    const token = randomBytes(32).toString("hex");
    const tokenHash = hash(token);
    this.database.connection
      .prepare("INSERT INTO history_links (token_hash, email, expires_at) VALUES (?, ?, ?)")
      .run(tokenHash, email, Date.now() + LINK_LIFETIME);
    const delivery = method === "whatsapp" ? this.whatsapp : this.email;
    const result = await delivery?.sendHistoryLink(readContactIdentity(email).value, token);
    if (!result || result.status === "failed" || result.status === "skipped") {
      this.database.connection
        .prepare("DELETE FROM history_links WHERE token_hash = ?")
        .run(tokenHash);
      throw new HttpError(
        503,
        method === "whatsapp"
          ? "We could not send the WhatsApp link. Try again later or choose email."
          : "We could not send a private link. Please try again later.",
      );
    }
  }

  exchange(token: string, ip: string): { token: string; expiresAt: number } {
    this.limit(`exchange:${ip}`, 30);
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new HttpError(401, "This link is invalid or expired. Request a new link.");
    // A single SQLite statement consumes the link, so concurrent exchanges cannot reuse it.
    const row = this.database.connection
      .prepare("DELETE FROM history_links WHERE token_hash = ? AND expires_at > ? RETURNING email")
      .get(hash(token), Date.now());
    if (!row)
      throw new HttpError(
        401,
        "This link is invalid, expired, or already used. Request a new link.",
      );
    const sessionToken = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + HISTORY_SESSION_SECONDS * 1000;
    this.database.connection
      .prepare("INSERT INTO history_sessions (token_hash, email, expires_at) VALUES (?, ?, ?)")
      .run(hash(sessionToken), String(row.email), expiresAt);
    return { token: sessionToken, expiresAt };
  }

  read(token: string): RequestHistory {
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new HttpError(401, "Open a private link to view your requests.");
    const session = this.database.connection
      .prepare(
        "SELECT email, expires_at FROM history_sessions WHERE token_hash = ? AND expires_at > ?",
      )
      .get(hash(token), Date.now());
    if (!session)
      throw new HttpError(401, "Your private session has expired. Request another private link.");
    const email = String(session.email);
    const contact = readContactIdentity(email);
    return {
      email: contact.method === "email" ? contact.value : "",
      contact: contact.value,
      contactMethod: contact.method,
      bookings:
        contact.method === "email"
          ? this.repository.listBookingsByEmail(contact.value)
          : this.repository.listBookingsByPhone(contact.value),
      locationRequests: this.repository
        .listLocationRequests()
        .filter((request) =>
          contact.method === "email"
            ? request.email === contact.value
            : request.phone === contact.value,
        ),
      expiresAt: Number(session.expires_at),
    };
  }

  logout(token: string): void {
    this.database.connection
      .prepare("DELETE FROM history_sessions WHERE token_hash = ?")
      .run(hash(token));
  }

  private limit(key: string, max: number): void {
    const now = Date.now();
    this.database.connection
      .prepare("DELETE FROM history_rate_limits WHERE resets_at <= ?")
      .run(now);
    const row = this.database.connection
      .prepare(
        "INSERT INTO history_rate_limits (key_hash, attempts, resets_at) VALUES (?, 1, ?) ON CONFLICT(key_hash) DO UPDATE SET attempts = attempts + 1 RETURNING attempts",
      )
      .get(hash(key), now + LINK_LIFETIME);
    if (Number(row?.attempts) > max)
      throw new HttpError(429, "Too many attempts. Please wait 15 minutes before trying again.");
  }

  private cleanup(): void {
    const now = Date.now();
    this.database.connection.prepare("DELETE FROM history_links WHERE expires_at <= ?").run(now);
    this.database.connection.prepare("DELETE FROM history_sessions WHERE expires_at <= ?").run(now);
  }
}
