import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

let database: DatabaseSync | undefined;

/** Shared connection to the app SQLite file (auth tables and working days). */
export function getSqliteDatabase(): DatabaseSync {
  if (!database) {
    const dataDirectory = path.join(process.cwd(), "data");
    fs.mkdirSync(dataDirectory, { recursive: true });
    database = new DatabaseSync(
      process.env.AUTH_DATABASE_PATH ?? path.join(dataDirectory, "auth.sqlite"),
    );
    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA foreign_keys = ON;");
  }
  return database;
}
