import { sql } from "../_lib/db.js";
import { requireAuth, getClientIp } from "../_lib/auth.js";
import { writeAudit } from "../_lib/audit.js";
import { toPublicPeca } from "../_lib/pecas.js";

export default async function handler(req, res) {
  const u = await requireAuth(req, res);
  if (!u) return;

  const id = Number(req.query.id);
  if (!id) return res.status(400).json({ error: "Id inválido." });

  if (req.method === "PATCH") {
    // Edição de produto já cadastrado — só Administrador.
    if (u.cargo !== "Administrador") {
      return res.status(403).json({ error: "Acesso não permitido para o seu perfil." });
    }
    const { codigo, cb, nome, cat, custo, preco, qtd, min, forn } = req.body || {};
    if (!codigo || !nome) return res.status(400).json({ error: "Informe código e nome." });
    if (custo === undefined || preco === undefined || custo === "" || preco === "") {
      return res.status(400).json({ error: "Informe o valor de compra e o valor de venda." });
    }
    const custoNum = Number(custo), precoNum = Number(preco), qtdNum = Number(qtd) || 0, minNum = Number(min) || 5;
    if (!Number.isFinite(custoNum) || custoNum < 0) return res.status(400).json({ error: "Valor de compra inválido." });
    if (!Number.isFinite(precoNum) || precoNum <= 0) return res.status(400).json({ error: "Valor de venda inválido." });
    if (!Number.isInteger(qtdNum) || qtdNum < 0) return res.status(400).json({ error: "Estoque atual inválido." });
    if (!Number.isInteger(minNum) || minNum < 0) return res.status(400).json({ error: "Estoque mínimo inválido." });

    try {
      const [updated] = await sql`
        UPDATE pecas SET
          codigo = ${codigo}, cb = ${cb || null}, nome = ${nome}, cat = ${cat || "Geral"},
          custo = ${custoNum}, preco = ${precoNum}, qtd = ${qtdNum},
          min = ${minNum}, forn = ${forn || "—"}
        WHERE id = ${id}
        RETURNING *
      `;
      if (!updated) return res.status(404).json({ error: "Peça não encontrada." });
      await writeAudit(u.login, "PECA_EDITAR", `Peça ${updated.codigo} (${updated.nome}) editada`, getClientIp(req));
      return res.status(200).json({ peca: toPublicPeca(updated, { includeCusto: true }) });
    } catch (e) {
      if (String(e.message).includes("duplicate key") || String(e.message).includes("unique")) {
        if (String(e.message).includes("pecas_cb_key")) {
          return res.status(409).json({ error: "Já existe uma peça com esse código de barras." });
        }
        return res.status(409).json({ error: "Já existe uma peça com esse código." });
      }
      throw e;
    }
  }

  if (req.method === "DELETE") {
    const [deleted] = await sql`DELETE FROM pecas WHERE id = ${id} RETURNING *`;
    if (!deleted) return res.status(404).json({ error: "Peça não encontrada." });
    await writeAudit(u.login, "PECA_EXCLUIR", `Peça ${deleted.codigo} (${deleted.nome}) excluída`, getClientIp(req));
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "PATCH, DELETE");
  return res.status(405).json({ error: "Método não permitido." });
}
