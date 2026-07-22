import { sql } from "../_lib/db.js";
import { requireAuth, getClientIp } from "../_lib/auth.js";
import { writeAudit } from "../_lib/audit.js";
import { toPublicVenda, LOGIN_CAIXA_COMPARTILHADO } from "../_lib/vendas.js";

export default async function handler(req, res) {
  const u = await requireAuth(req, res);
  if (!u) return;

  const id = Number(req.query.id);
  if (!id) return res.status(400).json({ error: "Id inválido." });

  if (req.method === "PATCH") {
    // Corrige o atendente responsável por uma venda já registrada (ex.: caixa
    // esqueceu de trocar o seletor antes de vender) — só Administrador.
    if (u.cargo !== "Administrador") {
      return res.status(403).json({ error: "Acesso não permitido para o seu perfil." });
    }
    const { atendenteId } = req.body || {};
    if (atendenteId === undefined || atendenteId === null || atendenteId === "") {
      return res.status(400).json({ error: "Selecione um atendente." });
    }
    const [selecionado] = await sql`
      SELECT id, nome FROM users
      WHERE id = ${Number(atendenteId)} AND cargo IN ('Atendente', 'Administrador') AND status = 'ativo'
        AND login <> ${LOGIN_CAIXA_COMPARTILHADO}
    `;
    if (!selecionado) return res.status(400).json({ error: "Atendente selecionado é inválido." });

    const [venda] = await sql`
      UPDATE vendas SET user_id = ${selecionado.id}, atendente = ${selecionado.nome}
      WHERE id = ${id}
      RETURNING *
    `;
    if (!venda) return res.status(404).json({ error: "Venda não encontrada." });

    const itens = await sql`SELECT * FROM venda_itens WHERE venda_id = ${venda.id}`;
    await writeAudit(u.login, "VENDA_EDITAR", `Atendente da venda ${venda.num} alterado para ${selecionado.nome}`, getClientIp(req), u.nome);
    return res.status(200).json({ venda: toPublicVenda(venda, itens) });
  }

  res.setHeader("Allow", "PATCH");
  return res.status(405).json({ error: "Método não permitido." });
}
