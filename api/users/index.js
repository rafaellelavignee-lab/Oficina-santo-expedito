import bcrypt from "bcryptjs";
import { sql } from "../_lib/db.js";
import { requireAdmin, toPublicUser, getClientIp } from "../_lib/auth.js";
import { writeAudit } from "../_lib/audit.js";

const CARGOS = ["Administrador", "Estoquista", "Atendente"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    const rows = await sql`SELECT * FROM users ORDER BY data_cad ASC`;
    return res.status(200).json({ users: rows.map(toPublicUser) });
  }

  if (req.method === "POST") {
    const { login, email, senha, nome, cargo } = req.body || {};
    if (!login || !senha || !nome || !cargo) {
      return res.status(400).json({ error: "Preencha todos os campos." });
    }
    if (!CARGOS.includes(cargo)) {
      return res.status(400).json({ error: "Cargo inválido." });
    }
    if (String(senha).length < 6) {
      return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
    }
    // Administrador loga com e-mail (mais seguro que um usuário previsível) — obrigatório só para esse cargo.
    const emailNorm = String(email || "").trim().toLowerCase();
    if (cargo === "Administrador") {
      if (!emailNorm) return res.status(400).json({ error: "Informe o e-mail do administrador." });
      if (!EMAIL_RE.test(emailNorm)) return res.status(400).json({ error: "E-mail inválido." });
    }
    const senhaHash = await bcrypt.hash(senha, 12);
    try {
      const [novo] = await sql`
        INSERT INTO users (login, email, senha_hash, nome, cargo)
        VALUES (${String(login).trim()}, ${emailNorm || null}, ${senhaHash}, ${nome}, ${cargo})
        RETURNING *
      `;
      await writeAudit(admin.login, "USER_CRIAR", `Usuário ${novo.login} (${novo.cargo}) cadastrado`, getClientIp(req));
      return res.status(201).json({ user: toPublicUser(novo) });
    } catch (e) {
      if (String(e.message).includes("duplicate key") || String(e.message).includes("unique")) {
        if (String(e.message).includes("users_email_key")) {
          return res.status(409).json({ error: "Já existe um usuário com esse e-mail." });
        }
        return res.status(409).json({ error: "Já existe um usuário com esse login." });
      }
      throw e;
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Método não permitido." });
}
