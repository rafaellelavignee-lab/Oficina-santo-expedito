import { sql } from "../../_lib/db.js";
import { requireAdmin, toPublicUser, getClientIp } from "../../_lib/auth.js";
import { writeAudit } from "../../_lib/audit.js";

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido." });
  }

  const id = Number(req.query.id);
  if (!id) return res.status(400).json({ error: "Id inválido." });

  const [updated] = await sql`UPDATE users SET fail = 0 WHERE id = ${id} RETURNING *`;
  if (!updated) return res.status(404).json({ error: "Usuário não encontrado." });
  await writeAudit(admin.login, "USER_DESBLOQUEAR", `${updated.login} desbloqueado`, getClientIp(req));
  return res.status(200).json({ user: toPublicUser(updated) });
}
