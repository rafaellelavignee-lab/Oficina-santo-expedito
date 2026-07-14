CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  login         TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE,
  senha_hash    TEXT NOT NULL,
  nome          TEXT NOT NULL,
  cargo         TEXT NOT NULL CHECK (cargo IN ('Administrador','Estoquista','Atendente')),
  status        TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  data_cad      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_acesso TIMESTAMPTZ,
  fail          INT NOT NULL DEFAULT 0
);

-- Administradores autenticam por e-mail, demais cargos por login. Coluna já
-- existe em bancos novos (CREATE TABLE acima), ALTER cobre bancos migrados antes dela existir.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS pecas (
  id      SERIAL PRIMARY KEY,
  codigo  TEXT UNIQUE NOT NULL,
  cb      TEXT UNIQUE,
  nome    TEXT NOT NULL,
  cat     TEXT NOT NULL DEFAULT 'Geral',
  custo   NUMERIC(10,2) NOT NULL DEFAULT 0,
  preco   NUMERIC(10,2) NOT NULL DEFAULT 0,
  qtd     INT NOT NULL DEFAULT 0,
  min     INT NOT NULL DEFAULT 5,
  forn    TEXT NOT NULL DEFAULT '—'
);

CREATE SEQUENCE IF NOT EXISTS venda_num_seq;

CREATE TABLE IF NOT EXISTS vendas (
  id         SERIAL PRIMARY KEY,
  num        TEXT UNIQUE NOT NULL,
  total      NUMERIC(10,2) NOT NULL,
  pag        TEXT NOT NULL DEFAULT 'Dinheiro',
  data       TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  atendente  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS venda_itens (
  id         SERIAL PRIMARY KEY,
  venda_id   INT NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  peca_id    INT REFERENCES pecas(id) ON DELETE SET NULL,
  tipo       TEXT NOT NULL CHECK (tipo IN ('peca','servico')),
  nome       TEXT NOT NULL,
  codigo     TEXT,
  descricao  TEXT,
  preco      NUMERIC(10,2) NOT NULL,
  qtd        INT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id    SERIAL PRIMARY KEY,
  usr   TEXT NOT NULL,
  acao  TEXT NOT NULL,
  det   TEXT NOT NULL,
  ts    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip    TEXT
);
