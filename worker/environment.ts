import type { BookingStore } from "./booking-store.js";

export interface Environment {
  ASSETS: Fetcher;
  BOOKINGS: DurableObjectNamespace<BookingStore>;
  ASA_BOLT_PUBLIC_APP_URL: string;
  ASA_BOLT_OWNER_PASSWORD: string;
  [key: string]: unknown;
}

export function serverEnvironment(env: Environment): NodeJS.ProcessEnv {
  const values = Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  return {
    ...values,
    NODE_ENV: values.NODE_ENV ?? "production",
    ASA_BOLT_TRUST_PROXY: "1",
    ASA_BOLT_STATIC_DIR: "",
    ASA_BOLT_BACKUP_DIR: "",
    ASA_BOLT_EMAIL_OUTBOX_DIR: "",
  };
}
