// Login do caixa compartilhado — não é uma pessoa vendendo de verdade, então
// não pode ser escolhido como atendente responsável por uma venda.
export const LOGIN_CAIXA_COMPARTILHADO = "caixa-loja";

export function toPublicVenda(v, itens) {
  return {
    id: v.id,
    num: v.num,
    total: Number(v.total),
    pag: v.pag,
    data: v.data,
    atendenteId: v.user_id,
    atendente: v.atendente,
    itens: itens.map(i => ({
      id: i.id,
      pecaId: i.peca_id,
      tipo: i.tipo,
      nome: i.nome,
      codigo: i.codigo,
      descricao: i.descricao,
      preco: Number(i.preco),
      qtd: i.qtd,
    })),
  };
}
