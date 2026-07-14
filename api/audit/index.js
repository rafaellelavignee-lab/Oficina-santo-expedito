import { sql } from "../_lib/db.js";
import { requireAdmin } from "../_lib/auth.js";

function toPublicEntry(l) {
  return { id: l.id, usr: l.usr, acao: l.acao, det: l.det, ts: l.ts, ip: l.ip };
}

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido." });
  }

  const rows = await sql`SELECT * FROM audit_log ORDER BY ts DESC LIMIT 500`;
  return res.status(200).json({ log: rows.map(toPublicEntry) });
}
