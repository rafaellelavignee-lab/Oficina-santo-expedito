import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não definida. Rode com: node --env-file=.env scripts/migrate.mjs");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const schemaPath = fileURLToPath(new URL("../db/schema.sql", import.meta.url));
const schema = readFileSync(schemaPath, "utf8");

const statements = schema
  .split(";")
  .map(s => s.trim())
  .filter(Boolean);

for (const stmt of statements) {
  await sql.query(stmt);
}
console.log(`Schema aplicado com sucesso (${statements.length} statements).`);
