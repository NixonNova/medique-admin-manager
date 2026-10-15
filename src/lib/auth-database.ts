import { Kysely, PostgresDialect } from "kysely";
import { getPgPool } from "@/lib/postgres-pool";

let kysely: Kysely<unknown> | undefined;

function getPostgresKysely(): Kysely<unknown> {
  if (!kysely) {
    kysely = new Kysely({
      dialect: new PostgresDialect({
        pool: getPgPool(),
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
