import { sql } from "../_lib/db.js";
import { requireRole, getClientIp } from "../_lib/auth.js";
import { toPublicPeca } from "../_lib/pecas.js";

export default async function handler(req, res) {
  // Entrada de estoque por bipe — Administrador ou Estoquista, não Atendente.
  const u = await requireRole(req, res, ["Administrador", "Estoquista"]);
  if (!u) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido." });
  }

  const { itens } = req.body || {};
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: "Nenhum item para dar entrada." });
  }

  const atualizadas = [];
  for (const it of itens) {
    const id = Number(it.id);
    const q = Number(it.qtd);
    if (!id || !q || q <= 0) continue;
    const [updated] = await sql`UPDATE pecas SET qtd = qtd + ${q} WHERE id = ${id} RETURNING *`;
    if (updated) atualizadas.push({ peca: updated, qtd: q });
  }

  if (!atualizadas.length) return res.status(400).json({ error: "Nenhuma peça válida encontrada." });

  const resumo = atualizadas.map(a => `${a.qtd}×${a.peca.nome}`).join(", ");
  await sql`INSERT INTO audit_log (usr, acao, det, ip) VALUES (${u.login}, 'ESTOQUE_BIP', ${`Entrada por leitura: ${resumo}`}, ${getClientIp(req)})`;

  const includeCusto = u.cargo === "Administrador";
  return res.status(200).json({ pecas: atualizadas.map(a => toPublicPeca(a.peca, { includeCusto })) });
}
