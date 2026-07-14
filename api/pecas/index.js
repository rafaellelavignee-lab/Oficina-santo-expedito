import { sql } from "../_lib/db.js";
import { requireAuth, getClientIp } from "../_lib/auth.js";
import { writeAudit } from "../_lib/audit.js";
import { toPublicPeca } from "../_lib/pecas.js";

export default async function handler(req, res) {
  const u = await requireAuth(req, res);
  if (!u) return;

  if (req.method === "GET") {
    const rows = await sql`SELECT * FROM pecas ORDER BY nome ASC`;
    const includeCusto = u.cargo === "Administrador";
    return res.status(200).json({ pecas: rows.map(p => toPublicPeca(p, { includeCusto })) });
  }

  if (req.method === "POST") {
    // Cadastro de produto define custo/preço (dado sensível) — só Administrador.
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
    if (!Number.isInteger(qtdNum) || qtdNum < 0) return res.status(400).json({ error: "Quantidade inicial inválida." });
    if (!Number.isInteger(minNum) || minNum < 0) return res.status(400).json({ error: "Estoque mínimo inválido." });
    try {
      const [novo] = await sql`
        INSERT INTO pecas (codigo, cb, nome, cat, custo, preco, qtd, min, forn)
        VALUES (${codigo}, ${cb || null}, ${nome}, ${cat || "Geral"}, ${custoNum}, ${precoNum}, ${qtdNum}, ${minNum}, ${forn || "—"})
        RETURNING *
      `;
      await writeAudit(u.login, "PECA_CRIAR", `Peça ${novo.codigo} (${novo.nome}) cadastrada`, getClientIp(req));
      return res.status(201).json({ peca: toPublicPeca(novo, { includeCusto: true }) });
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

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Método não permitido." });
}
