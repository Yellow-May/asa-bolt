import type {
  SqlConnection,
  SqlDriver,
  SqlValue,
} from "../server/infrastructure/sql-connection.js";

export class CloudflareSqlDriver implements SqlDriver {
  readonly connection: SqlConnection;

  constructor(private readonly storage: DurableObjectStorage) {
    this.connection = {
      exec: (query) => {
        storage.sql.exec(query).toArray();
      },
      prepare: (query) => ({
        get: (...values) => this.query(query, values)[0],
        all: (...values) => this.query(query, values),
        run: (...values) => {
          this.query(query, values);
          return { changes: Number(storage.sql.exec("SELECT changes() AS count").one().count) };
        },
      }),
      close: () => undefined,
    };
  }

  transaction<T>(callback: () => T): T {
    return this.storage.transactionSync(callback);
  }

  private query(query: string, values: SqlValue[]) {
    return this.storage.sql.exec(query, ...values.map(binding)).toArray();
  }
}

function binding(value: SqlValue): string | number | null | ArrayBuffer {
  if (typeof value === "bigint") {
    const number = Number(value);
    if (!Number.isSafeInteger(number)) throw new Error("SQL integer exceeds safe precision.");
    return number;
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice().buffer;
  }
  return value;
}
