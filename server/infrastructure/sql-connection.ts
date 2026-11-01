export type SqlValue = string | number | bigint | null | NodeJS.ArrayBufferView;
export type SqlRow = Record<string, unknown>;

export interface SqlStatement {
  get(...values: SqlValue[]): SqlRow | undefined;
  all(...values: SqlValue[]): SqlRow[];
  run(...values: SqlValue[]): { changes: number | bigint };
}

export interface SqlConnection {
  prepare(query: string): SqlStatement;
  exec(query: string): void;
  close(): void;
}

export interface SqlDriver<Connection extends SqlConnection = SqlConnection> {
  connection: Connection;
  transaction<T>(callback: () => T): T;
}

export interface ApplicationDatabase {
  readonly filePath: string;
  readonly connection: SqlConnection;
  transaction<T>(callback: () => T): T;
  close(): void;
}
