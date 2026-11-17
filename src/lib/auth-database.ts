import { Kysely, PostgresDialect } from "kysely";
import { getPgPool } from "@/lib/postgres-pool";

let kysely: Kysely<unknown> | undefined;

function getPostgresKysely(): Kysely<unknown> {
  if (!kysely) {
    // Next imports the auth route while collecting page data. DigitalOcean
    // only injects DATABASE_URL at runtime, so the pool must wait for a query.
    kysely = new Kysely({
      dialect: new PostgresDialect({
        pool: async () => getPgPool(),
      }),
    });
  }
  return kysely;
}

export type AuthDatabase = {
  db: Kysely<unknown>;
  type: "postgres";
};

export function getAuthDatabase(): AuthDatabase {
  return {
    db: getPostgresKysely(),
    type: "postgres",
  };
}
