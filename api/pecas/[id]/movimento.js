import { sql } from "../../_lib/db.js";
import { requireRole, getClientIp } from "../../_lib/auth.js";
import { toPublicPeca } from "../../_lib/pecas.js";

export default async function handler(req, res) {
  // Ajuste de quantidade em estoque — Administrador ou Estoquista, não Atendente.
  const u = await requireRole(req, res, ["Administrador", "Estoquista"]);
  if (!u) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido." });
  }

  const id = Number(req.query.id);
  if (!id) return res.status(400).json({ error: "Id inválido." });

  const { tipo, qtd, desc } = req.body || {};
  const q = Number(qtd);
  if (!["entrada", "saida"].includes(tipo) || !q || q <= 0) {
    return res.status(400).json({ error: "Selecione o tipo e informe uma quantidade válida." });
  }

  const [updated] = tipo === "entrada"
    ? await sql`UPDATE pecas SET qtd = qtd + ${q} WHERE id = ${id} RETURNING *`
    : await sql`UPDATE pecas SET qtd = GREATEST(0, qtd - ${q}) WHERE id = ${id} RETURNING *`;

  if (!updated) return res.status(404).json({ error: "Peça não encontrada." });

  const det = `${tipo === "entrada" ? "Entrada" : "Saída"} ${q}×${updated.nome} (${desc || "sem motivo"})`;
  await sql`INSERT INTO audit_log (usr, acao, det, ip) VALUES (${u.login}, 'ESTOQUE_MOV', ${det}, ${getClientIp(req)})`;

  return res.status(200).json({ peca: toPublicPeca(updated, { includeCusto: u.cargo === "Administrador" }) });
}
