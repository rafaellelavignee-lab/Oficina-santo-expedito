import bcrypt from "bcryptjs";
import { sql } from "../_lib/db.js";
import { signSession, setSessionCookie, toPublicUser, getClientIp } from "../_lib/auth.js";
import { writeAudit } from "../_lib/audit.js";

const MAX_FAIL = 5;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido." });
  }

  const ip = getClientIp(req);
  const { login, senha } = req.body || {};
  if (!login || !senha) {
    return res.status(400).json({ error: "Informe usuário/e-mail e senha." });
  }

  // Administrador loga com e-mail; Estoquista/Atendente, com login (usuário). O mesmo
  // campo aceita os dois — o servidor decide comparando com ambas as colunas.
  const identificador = String(login).trim().toLowerCase();
  const rows = await sql`SELECT * FROM users WHERE lower(login) = ${identificador} OR lower(email) = ${identificador}`;
  const u = rows[0];

  if (!u) {
    await writeAudit(String(login).trim(), "LOGIN_FALHA", "Usuário não encontrado", ip);
    return res.status(401).json({ error: "Usuário ou senha inválidos." });
  }
  if (u.status === "inativo") {
    await writeAudit(u.login, "LOGIN_FALHA", "Conta inativa", ip, u.nome);
    return res.status(403).json({ error: "Usuário desativado." });
  }
  if (u.fail >= MAX_FAIL) {
    await writeAudit(u.login, "LOGIN_FALHA", "Conta bloqueada", ip, u.nome);
    return res.status(403).json({ error: "Conta bloqueada por excesso de tentativas. Peça a um administrador para desbloquear." });
  }

  const ok = await bcrypt.compare(senha, u.senha_hash);
  if (!ok) {
    const [updated] = await sql`UPDATE users SET fail = fail + 1 WHERE id = ${u.id} RETURNING fail`;
    const remaining = Math.max(0, MAX_FAIL - updated.fail);
    await writeAudit(u.login, "LOGIN_FALHA", `Tentativa ${updated.fail}/${MAX_FAIL}`, ip, u.nome);
    return res.status(401).json({ error: `Usuário ou senha inválidos. Tentativas restantes: ${remaining}.` });
  }

  const [fresh] = await sql`UPDATE users SET fail = 0, ultimo_acesso = now() WHERE id = ${u.id} RETURNING *`;

  setSessionCookie(res, signSession(fresh.id));
  await writeAudit(fresh.login, "LOGIN", "Login bem-sucedido", ip, fresh.nome);
  return res.status(200).json({ user: toPublicUser(fresh) });
}
