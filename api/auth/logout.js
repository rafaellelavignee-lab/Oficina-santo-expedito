import { clearSessionCookie, getSessionUser, getClientIp } from "../_lib/auth.js";
import { writeAudit } from "../_lib/audit.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido." });
  }
  const u = await getSessionUser(req);
  clearSessionCookie(res);
  if (u) await writeAudit(u.login, "LOGOUT", "Sessão encerrada", getClientIp(req), u.nome);
  return res.status(200).json({ ok: true });
}
