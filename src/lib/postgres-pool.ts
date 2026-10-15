import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | undefined;

export function getPgPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured.");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}
