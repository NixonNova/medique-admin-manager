import { getPgPool } from "@/lib/postgres-pool";

type SqlParam = string | number | boolean | null | Date | bigint;
type SqlParams = SqlParam[];

export type AppDatabase = {
  all<T>(sql: string, params?: SqlParams): Promise<T[]>;
  get<T>(sql: string, params?: SqlParams): Promise<T | undefined>;
  run(sql: string, params?: SqlParams): Promise<{ changes: number }>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T>;
};

function toPgSql(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function createPostgresAppDatabase(): AppDatabase {
  const pool = getPgPool();
  const db: AppDatabase = {
    async all<T>(sql: string, params: SqlParams = []) {
      const result = await pool.query(toPgSql(sql), params);
      return result.rows as T[];
    },
    async get<T>(sql: string, params: SqlParams = []) {
      const result = await pool.query(toPgSql(sql), params);
      return result.rows[0] as T | undefined;
    },
    async run(sql: string, params: SqlParams = []) {
      const result = await pool.query(toPgSql(sql), params);
      return { changes: result.rowCount ?? 0 };
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async transaction<T>(fn: (db: AppDatabase) => Promise<T>) {
      const client = await pool.connect();
      const clientDb: AppDatabase = {
        all: async <T>(sql: string, params: SqlParams = []) => {
          const result = await client.query(toPgSql(sql), params);
          return result.rows as T[];
        },
        get: async <T>(sql: string, params: SqlParams = []) => {
          const result = await client.query(toPgSql(sql), params);
          return result.rows[0] as T | undefined;
        },
        run: async (sql: string, params: SqlParams = []) => {
          const result = await client.query(toPgSql(sql), params);
          return { changes: result.rowCount ?? 0 };
        },
        exec: async (sql: string) => {
          await client.query(sql);
        },
        transaction: async <U>(inner: (tx: AppDatabase) => Promise<U>) => inner(clientDb),
      };

      try {
        await client.query("BEGIN");
        const value = await fn(clientDb);
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
  return db;
}

export async function getAppDatabase(): Promise<AppDatabase> {
  return createPostgresAppDatabase();
}
