import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

function uso() {
  console.error(
    "Uso: node --env-file=.env scripts/seed-admin.mjs --login=daniel.gomes --email=daniel@suaoficina.com --nome=\"Daniel Gomes Araujo\" [--cargo=Administrador]"
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não definida. Rode com: node --env-file=.env scripts/seed-admin.mjs ...");
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith("--"))
    .map(a => {
      const [k, ...rest] = a.slice(2).split("=");
      return [k, rest.join("=")];
    })
);

const login = (args.login || "").trim();
const email = (args.email || "").trim().toLowerCase();
const nome = (args.nome || "").trim();
const cargo = args.cargo || "Administrador";

if (!login || !nome) uso();
if (cargo === "Administrador" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Informe um --email válido (obrigatório para cargo Administrador).");
  uso();
}

const sql = neon(process.env.DATABASE_URL);

// Remove as contas de demonstração (admin/estoque/atendente) — usuários reais entram no lugar.
await sql`DELETE FROM users WHERE login IN ('admin', 'estoque', 'atendente')`;
console.log("Contas demo removidas.");

const existing = await sql`SELECT id FROM users WHERE login = ${login}`;
if (existing.length) {
  console.log(`Usuário "${login}" já existe, nada a fazer.`);
  process.exit(0);
}

// Senha gerada na hora — nunca fica hardcoded no código-fonte/repositório.
const senha = randomBytes(9).toString("base64url");
const senhaHash = await bcrypt.hash(senha, 12);

await sql`
  INSERT INTO users (login, email, senha_hash, nome, cargo)
  VALUES (${login}, ${email || null}, ${senhaHash}, ${nome}, ${cargo})
`;

console.log(`Usuário "${login}" criado.`);
console.log(`Senha inicial (anote agora, não é exibida de novo): ${senha}`);
