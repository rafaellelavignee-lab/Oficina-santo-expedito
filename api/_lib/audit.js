import { sql } from "./db.js";

export async function writeAudit(usr, acao, det, ip, nome = null) {
  await sql`INSERT INTO audit_log (usr, acao, det, ip, nome) VALUES (${usr}, ${acao}, ${det}, ${ip}, ${nome})`;
}
