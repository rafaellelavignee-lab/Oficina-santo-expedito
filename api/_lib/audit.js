import { sql } from "./db.js";

export async function writeAudit(usr, acao, det, ip) {
  await sql`INSERT INTO audit_log (usr, acao, det, ip) VALUES (${usr}, ${acao}, ${det}, ${ip})`;
}
