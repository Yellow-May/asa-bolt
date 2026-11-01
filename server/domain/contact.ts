import type { ContactMethod } from "../../shared/contracts.js";
import { HttpError } from "../errors.js";
import { normalizeEmail, normalizePhone } from "./rules.js";

export function contactMethod(value: unknown): ContactMethod {
  if (value === undefined || value === "email") return "email";
  if (value === "whatsapp") return "whatsapp";
  throw new HttpError(400, "Choose email or WhatsApp.");
}

export function contactIdentity(method: ContactMethod, value: string): string {
  return method === "email" ? normalizeEmail(value) : `whatsapp:${normalizePhone(value)}`;
}

export function readContactIdentity(identity: string) {
  return /^whatsapp:\+234\d{10}$/.test(identity)
    ? { method: "whatsapp" as const, value: identity.slice(9) }
    : { method: "email" as const, value: identity };
}
