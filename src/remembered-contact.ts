import type { ContactMethod } from "../shared/contracts";
import { readStoredValue, removeStoredValue, storeValue } from "./browser-storage";

export interface RememberedContact {
  method: ContactMethod;
  value: string;
}

const contactKey = "asa-bolt-booking-contact";

export function readRememberedContact(): RememberedContact | undefined {
  try {
    const contact: unknown = JSON.parse(readStoredValue(contactKey) || "null");
    if (!contact || typeof contact !== "object" || !("method" in contact) || !("value" in contact))
      return;
    if (typeof contact.value !== "string") return;
    if (
      contact.method === "email" &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.value) &&
      contact.value.length <= 254
    )
      return { method: "email", value: contact.value };
    if (contact.method === "whatsapp" && /^\+234\d{10}$/.test(contact.value))
      return { method: "whatsapp", value: contact.value };
  } catch {
    console.warn("The saved booking contact could not be restored.");
  }
}

export function rememberContact(contact: RememberedContact): boolean {
  return storeValue(contactKey, JSON.stringify(contact));
}

export function forgetContact(): boolean {
  return removeStoredValue(contactKey);
}

export function rememberedContactFields(contact?: RememberedContact) {
  return {
    contactMethod: contact?.method ?? "email",
    email: contact?.method === "email" ? contact.value : "",
    whatsappNumber: contact?.method === "whatsapp" ? contact.value : "",
  };
}
