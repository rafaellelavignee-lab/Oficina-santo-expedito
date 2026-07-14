// Custo de compra é dado sensível de negócio (margem) — só o Administrador recebe.
export function toPublicPeca(p, { includeCusto = false } = {}) {
  const base = {
    id: p.id,
    codigo: p.codigo,
    cb: p.cb,
    nome: p.nome,
    cat: p.cat,
    preco: Number(p.preco),
    qtd: p.qtd,
    min: p.min,
    forn: p.forn,
  };
  if (includeCusto) base.custo = Number(p.custo);
  return base;
}
