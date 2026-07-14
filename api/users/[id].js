import { sql } from "../_lib/db.js";
import { requireAdmin, toPublicUser, getClientIp } from "../_lib/auth.js";
import { writeAudit } from "../_lib/audit.js";

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = Number(req.query.id);
  if (!id) return res.status(400).json({ error: "Id inválido." });

  const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
  const target = rows[0];
  if (!target) return res.status(404).json({ error: "Usuário não encontrado." });

  if (req.method === "PATCH") {
    const { status } = req.body || {};
    if (!["ativo", "inativo"].includes(status)) {
      return res.status(400).json({ error: "Status inválido." });
    }
    if (target.id === admin.id) {
      return res.status(400).json({ error: "Você não pode alterar seu próprio status." });
    }
    const [updated] = await sql`UPDATE users SET status = ${status} WHERE id = ${id} RETURNING *`;
    await writeAudit(admin.login, "USER_STATUS", `${updated.login} → ${status}`, getClientIp(req));
    return res.status(200).json({ user: toPublicUser(updated) });
  }

  if (req.method === "DELETE") {
    if (target.id === admin.id) {
      return res.status(400).json({ error: "Você não pode excluir sua própria conta." });
    }
    if (target.cargo === "Administrador") {
      return res.status(400).json({ error: "Não é possível excluir um Administrador." });
    }
    await sql`DELETE FROM users WHERE id = ${id}`;
    await writeAudit(admin.login, "USER_EXCLUIR", `Usuário ${target.login} excluído`, getClientIp(req));
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "PATCH, DELETE");
  return res.status(405).json({ error: "Método não permitido." });
}
