import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não definida. Rode com: node --env-file=.env scripts/seed-admin.mjs");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// Remove as contas de demonstração (admin/estoque/atendente) — usuários reais entram no lugar.
await sql`DELETE FROM users WHERE login IN ('admin', 'estoque', 'atendente')`;
console.log("Contas demo removidas.");

// Gera uma senha aleatória em vez de gravar uma fixa no código-fonte — evita
// deixar uma credencial de Administrador previsível numa conta real de produção.
const gerarSenha = () => randomBytes(9).toString("base64url");

const REAL_USERS = [
  { login: "daniel.gomes", email: "daniel.gomes@exemplo.com", senha: gerarSenha(), nome: "Daniel Gomes Araujo", cargo: "Administrador" },
];

for (const u of REAL_USERS) {
  const senhaHash = await bcrypt.hash(u.senha, 12);
  const existing = await sql`SELECT id FROM users WHERE login = ${u.login}`;
  if (existing.length) {
    console.log(`Usuário "${u.login}" já existe, pulando.`);
    continue;
  }
  await sql`
    INSERT INTO users (login, email, senha_hash, nome, cargo)
    VALUES (${u.login}, ${u.email || null}, ${senhaHash}, ${u.nome}, ${u.cargo})
  `;
  console.log(`Usuário "${u.login}" criado. Senha inicial (anote agora, não é exibida de novo): ${u.senha}`);
}
