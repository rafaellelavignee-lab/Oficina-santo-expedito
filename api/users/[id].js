import { sql } from "../_lib/db.js";
import { requireAdmin, toPublicUser, getClientIp } from "../_lib/auth.js";
import { writeAudit } from "../_lib/audit.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const id = Number(req.query.id);
  if (!id) return res.status(400).json({ error: "Id inválido." });

  const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
  const target = rows[0];
  if (!target) return res.status(404).json({ error: "Usuário não encontrado." });

  if (req.method === "PATCH") {
    const { status, email, nome } = req.body || {};
    const alteraStatus = status !== undefined;
    const alteraEmail = email !== undefined;
    const alteraNome = nome !== undefined;
    if (!alteraStatus && !alteraEmail && !alteraNome) {
      return res.status(400).json({ error: "Nenhuma alteração informada." });
    }

    let novoStatus = target.status;
    if (alteraStatus) {
      if (!["ativo", "inativo"].includes(status)) return res.status(400).json({ error: "Status inválido." });
      if (target.id === admin.id) return res.status(400).json({ error: "Você não pode alterar seu próprio status." });
      novoStatus = status;
    }

    let novoEmail = target.email;
    if (alteraEmail) {
      novoEmail = String(email || "").trim().toLowerCase() || null;
      if (novoEmail && !EMAIL_RE.test(novoEmail)) return res.status(400).json({ error: "E-mail inválido." });
      const cargoFinal = target.cargo;
      if (cargoFinal === "Administrador" && !novoEmail) {
        return res.status(400).json({ error: "Administrador precisa de um e-mail para entrar no sistema." });
      }
    }

    let novoNome = target.nome;
    if (alteraNome) {
      novoNome = String(nome || "").trim();
      if (!novoNome) return res.status(400).json({ error: "Informe o nome." });
    }

    try {
      const [updated] = await sql`
        UPDATE users SET status = ${novoStatus}, email = ${novoEmail}, nome = ${novoNome}
        WHERE id = ${id}
        RETURNING *
      `;
      const acao = alteraStatus && !alteraEmail && !alteraNome ? "USER_STATUS" : "USER_EDITAR";
      const mudancas = [];
      if (alteraStatus) mudancas.push(`status → ${novoStatus}`);
      if (alteraEmail) mudancas.push(`e-mail → ${novoEmail || "—"}`);
      if (alteraNome) mudancas.push(`nome → ${novoNome}`);
      await writeAudit(admin.login, acao, `${updated.login}: ${mudancas.join(", ")}`, getClientIp(req));
      return res.status(200).json({ user: toPublicUser(updated) });
    } catch (e) {
      if (String(e.message).includes("duplicate key") || String(e.message).includes("unique")) {
        return res.status(409).json({ error: "Já existe um usuário com esse e-mail." });
      }
      throw e;
    }
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
