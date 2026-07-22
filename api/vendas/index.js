import { sql } from "../_lib/db.js";
import { requireAuth, getClientIp } from "../_lib/auth.js";
import { writeAudit } from "../_lib/audit.js";
import { toPublicVenda, LOGIN_CAIXA_COMPARTILHADO } from "../_lib/vendas.js";

const SERVICOS = ["Mão de obra", "Revisão"];
const PAGAMENTOS = ["Dinheiro", "PIX", "Débito", "Crédito"];

export default async function handler(req, res) {
  const u = await requireAuth(req, res);
  if (!u) return;

  if (req.method === "GET") {
    const vendas = await sql`SELECT * FROM vendas ORDER BY data DESC LIMIT 200`;
    const ids = vendas.map(v => v.id);
    const itens = ids.length ? await sql`SELECT * FROM venda_itens WHERE venda_id = ANY(${ids})` : [];
    const porVenda = new Map();
    for (const it of itens) {
      if (!porVenda.has(it.venda_id)) porVenda.set(it.venda_id, []);
      porVenda.get(it.venda_id).push(it);
    }
    return res.status(200).json({ vendas: vendas.map(v => toPublicVenda(v, porVenda.get(v.id) || [])) });
  }

  if (req.method === "POST") {
    const { itens, pag, atendenteId } = req.body || {};
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: "Nenhum item na venda." });
    }

    // Vendedor responsável pela venda — por padrão quem está logado, mas o
    // terminal de caixa pode ficar aberto num login só o turno todo: se vier
    // um atendenteId válido, a venda é atribuída a ele em vez de quem logou.
    let vendedorId = u.id;
    let vendedorNome = u.nome;
    if (atendenteId !== undefined && atendenteId !== null && atendenteId !== "") {
      const [selecionado] = await sql`
        SELECT id, nome FROM users
        WHERE id = ${Number(atendenteId)} AND cargo IN ('Atendente', 'Administrador') AND status = 'ativo'
          AND login <> ${LOGIN_CAIXA_COMPARTILHADO}
      `;
      if (!selecionado) return res.status(400).json({ error: "Atendente selecionado é inválido." });
      vendedorId = selecionado.id;
      vendedorNome = selecionado.nome;
    }

    // Preço de peça nunca vem do cliente — sempre recalculado a partir do banco,
    // para que o valor cobrado não possa ser manipulado na requisição.
    const pecaIds = [...new Set(
      itens.filter(i => i.tipo !== "servico").map(i => Number(i.id)).filter(Boolean)
    )];
    const pecasRows = pecaIds.length ? await sql`SELECT * FROM pecas WHERE id = ANY(${pecaIds})` : [];
    const pecasMap = new Map(pecasRows.map(p => [p.id, p]));

    const itensValidados = [];
    for (const raw of itens) {
      const qtd = Number(raw.qtd);
      if (!Number.isFinite(qtd) || qtd <= 0) {
        return res.status(400).json({ error: "Quantidade inválida em um dos itens." });
      }
      if (raw.tipo === "servico") {
        const nome = String(raw.nome || "").trim();
        const preco = Number(raw.preco);
        if (!SERVICOS.includes(nome)) return res.status(400).json({ error: "Tipo de serviço inválido." });
        if (!Number.isFinite(preco) || preco <= 0) return res.status(400).json({ error: "Valor de serviço inválido." });
        itensValidados.push({
          tipo: "servico", pecaId: null, nome, codigo: null,
          descricao: String(raw.descricao || "").trim() || null, preco, qtd,
        });
      } else {
        const peca = pecasMap.get(Number(raw.id));
        if (!peca) return res.status(400).json({ error: "Peça não encontrada em um dos itens." });
        if (peca.qtd < qtd) {
          return res.status(409).json({ error: `Estoque insuficiente de ${peca.nome} (disponível: ${peca.qtd}).` });
        }
        itensValidados.push({
          tipo: "peca", pecaId: peca.id, nome: peca.nome, codigo: peca.codigo,
          descricao: null, preco: Number(peca.preco), qtd,
        });
      }
    }

    const pagamento = PAGAMENTOS.includes(pag) ? pag : "Dinheiro";
    const total = itensValidados.reduce((a, i) => a + i.preco * i.qtd, 0);
    // Defesa extra: mesmo com preço de peça sempre recalculado do banco, nunca grava venda com total inválido.
    if (!Number.isFinite(total) || total <= 0) {
      return res.status(400).json({ error: "Total da venda inválido." });
    }

    const [{ n }] = await sql`SELECT nextval('venda_num_seq') AS n`;
    const num = `V-${String(n).padStart(4, "0")}`;

    const [venda] = await sql`
      INSERT INTO vendas (num, total, pag, user_id, atendente)
      VALUES (${num}, ${total}, ${pagamento}, ${vendedorId}, ${vendedorNome})
      RETURNING *
    `;

    for (const it of itensValidados) {
      await sql`
        INSERT INTO venda_itens (venda_id, peca_id, tipo, nome, codigo, descricao, preco, qtd)
        VALUES (${venda.id}, ${it.pecaId}, ${it.tipo}, ${it.nome}, ${it.codigo}, ${it.descricao}, ${it.preco}, ${it.qtd})
      `;
      // Condição no WHERE evita estoque negativo mesmo sob concorrência (venda simultânea).
      if (it.tipo === "peca") {
        await sql`UPDATE pecas SET qtd = qtd - ${it.qtd} WHERE id = ${it.pecaId} AND qtd >= ${it.qtd}`;
      }
    }

    const resumo = itensValidados.map(i => `${i.qtd}×${i.nome}`).join(", ");
    await sql`
      INSERT INTO audit_log (usr, acao, det, ip, nome)
      VALUES (${u.login}, 'VENDA', ${`${num} finalizada – ${resumo} (R$ ${total.toFixed(2)} · ${pagamento}) · Atendente: ${vendedorNome}`}, ${getClientIp(req)}, ${u.nome})
    `;

    const itensRows = await sql`SELECT * FROM venda_itens WHERE venda_id = ${venda.id}`;
    return res.status(201).json({ venda: toPublicVenda(venda, itensRows) });
  }

  if (req.method === "PATCH") {
    // Corrige o atendente responsável por uma venda já registrada (ex.: caixa
    // esqueceu de trocar o seletor antes de vender) — só Administrador.
    // Vai junto com GET/POST em vez de um arquivo [id].js à parte porque o
    // plano Hobby da Vercel tem teto de 12 Serverless Functions.
    if (u.cargo !== "Administrador") {
      return res.status(403).json({ error: "Acesso não permitido para o seu perfil." });
    }
    const { id, atendenteId } = req.body || {};
    const vendaId = Number(id);
    if (!vendaId) return res.status(400).json({ error: "Venda inválida." });
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
      WHERE id = ${vendaId}
      RETURNING *
    `;
    if (!venda) return res.status(404).json({ error: "Venda não encontrada." });

    const itensRows = await sql`SELECT * FROM venda_itens WHERE venda_id = ${venda.id}`;
    await writeAudit(u.login, "VENDA_EDITAR", `Atendente da venda ${venda.num} alterado para ${selecionado.nome}`, getClientIp(req), u.nome);
    return res.status(200).json({ venda: toPublicVenda(venda, itensRows) });
  }

  res.setHeader("Allow", "GET, POST, PATCH");
  return res.status(405).json({ error: "Método não permitido." });
}
