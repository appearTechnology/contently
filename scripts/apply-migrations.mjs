// One-shot migration applier — runs every .sql file in supabase/migrations/
// in lexical order against POSTGRES_URL_NON_POOLING.
//
// Usage:  node --env-file=.env.local scripts/apply-migrations.mjs
//
// Idempotent migrations only — each file should use `create … if not exists`
// or `drop … if exists` patterns so re-running is safe.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";

const conn = process.env.POSTGRES_URL_NON_POOLING;
if (!conn) {
  console.error("POSTGRES_URL_NON_POOLING is not set.");
  process.exit(1);
}

const dir = new URL("../supabase/migrations/", import.meta.url).pathname;
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

if (files.length === 0) {
  console.log("No .sql migrations found in supabase/migrations/");
  process.exit(0);
}

const sanitized = conn.replace(/[?&]sslmode=[^&]+/g, "");
const client = new Client({
  connectionString: sanitized,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  for (const file of files) {
    const sql = await readFile(join(dir, file), "utf8");
    process.stdout.write(`Applying ${file}… `);
    await client.query(sql);
    console.log("ok");
  }
} finally {
  await client.end();
}
