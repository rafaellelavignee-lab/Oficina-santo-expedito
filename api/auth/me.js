import { getSessionUser, toPublicUser } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido." });
  }
  const u = await getSessionUser(req);
  if (!u) return res.status(401).json({ error: "Não autenticado." });
  return res.status(200).json({ user: toPublicUser(u) });
}
