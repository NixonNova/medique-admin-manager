/**
 * Deletes a Better Auth user (and cascaded session/account rows) by email from Neon Postgres.
 * Usage: npx tsx scripts/remove-user-by-email.ts nixonnova@outlook.com
 */
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config();

const emailArg = process.argv[2]?.trim().toLowerCase();
if (!emailArg) {
  console.error("Usage: npx tsx scripts/remove-user-by-email.ts <email>");
  process.exit(1);
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not set (add it to .env.local).");
  }
  return url;
}

async function removeFromPostgres(databaseUrl: string, email: string) {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query(`SELECT id FROM "user" WHERE lower(email) = lower($1)`, [
      email,
    ]);
    const user = result.rows[0] as { id: string } | undefined;
    if (!user) {
      console.log(`Postgres: no user ${email}`);
      return;
    }
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [user.id]);
    console.log(`Postgres: removed ${email}`);
  } finally {
    await pool.end();
  }
}

removeFromPostgres(requireDatabaseUrl(), emailArg).catch((error) => {
  console.error(error);
  process.exit(1);
});
