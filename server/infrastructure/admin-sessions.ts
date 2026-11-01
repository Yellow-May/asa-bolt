import { createHash } from "node:crypto";
import type { ApplicationDatabase as Database } from "./database.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export class AdminSessions {
  private readonly credentialHash: string;

  constructor(
    private readonly database: Database,
    password: string,
  ) {
    this.credentialHash = hash(password);
    database.connection.exec(
      "CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, credential_hash TEXT NOT NULL, expires_at INTEGER NOT NULL)",
    );
  }

  set(token: string, expiresAt: number): void {
    this.database.connection
      .prepare(
        "INSERT INTO admin_sessions (token_hash, credential_hash, expires_at) VALUES (?, ?, ?)",
      )
      .run(hash(token), this.credentialHash, expiresAt);
  }

  get(token: string): number | undefined {
    const row = this.read(hash(token));
    return row ? Number(row.expires_at) : undefined;
  }

  hasHash(tokenHash: string): boolean {
    return Boolean(this.read(tokenHash));
  }

  delete(token: string): void {
    this.database.connection
      .prepare("DELETE FROM admin_sessions WHERE token_hash = ?")
      .run(hash(token));
  }

  cleanup(): void {
    this.database.connection
      .prepare("DELETE FROM admin_sessions WHERE expires_at <= ? OR credential_hash != ?")
      .run(Date.now(), this.credentialHash);
  }

  private read(tokenHash: string) {
    return this.database.connection
      .prepare(
        "SELECT expires_at FROM admin_sessions WHERE token_hash = ? AND credential_hash = ? AND expires_at > ?",
      )
      .get(tokenHash, this.credentialHash, Date.now());
  }
}
