/* eslint-disable no-console */
/**
 * Tiny migration runner. Applies every .sql file in ./migrations in order.
 * Usage: DATABASE_URL=postgres://... node database/run-migrations.js
 */
const fs = require("fs");
const path = require("path");

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  let Pool;
  try {
    ({ Pool } = require("pg"));
  } catch {
    console.error('Missing dependency "pg". Run `npm install` first.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const dir = path.join(__dirname, "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      console.log(`Applying ${file} ...`);
      await pool.query(sql);
    }
    console.log(`Done. Applied ${files.length} migration(s).`);
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
