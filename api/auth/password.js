import bcrypt from "bcryptjs";
import { sql } from "../_lib/db.js";
import { requireAuth, getClientIp } from "../_lib/auth.js";
import { writeAudit } from "../_lib/audit.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido." });
  }

  const u = await requireAuth(req, res);
  if (!u) return;

  const { senhaAtual, novaSenha } = req.body || {};
  if (!senhaAtual || !novaSenha) {
    return res.status(400).json({ error: "Informe a senha atual e a nova senha." });
  }
  if (String(novaSenha).length < 6) {
    return res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres." });
  }

  const ok = await bcrypt.compare(senhaAtual, u.senha_hash);
  if (!ok) {
    return res.status(401).json({ error: "Senha atual incorreta." });
  }

  const senhaHash = await bcrypt.hash(novaSenha, 12);
  await sql`UPDATE users SET senha_hash = ${senhaHash} WHERE id = ${u.id}`;
  await writeAudit(u.login, "SENHA_ALTERAR", "Senha alterada pelo próprio usuário", getClientIp(req));
  return res.status(200).json({ ok: true });
}
