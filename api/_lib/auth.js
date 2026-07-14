import jwt from "jsonwebtoken";
import { serialize, parse } from "cookie";
import { sql } from "./db.js";

const COOKIE_NAME = "se_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8h — dura um turno de trabalho

export function signSession(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS });
}

function cookieOpts(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", serialize(COOKIE_NAME, token, cookieOpts(SESSION_TTL_SECONDS)));
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", serialize(COOKIE_NAME, "", cookieOpts(0)));
}

function getToken(req) {
  const cookies = req.cookies || parse(req.headers.cookie || "");
  return cookies[COOKIE_NAME];
}

// Formato usado pelo front hoje: id, login, nome, cargo, dataCad, status, ultimoAcesso, fail — sem senha.
export function toPublicUser(u) {
  return {
    id: u.id,
    login: u.login,
    email: u.email || null,
    nome: u.nome,
    cargo: u.cargo,
    status: u.status,
    dataCad: u.data_cad,
    ultimoAcesso: u.ultimo_acesso,
    fail: u.fail,
  };
}

// Rebusca o usuário no banco a cada request — nunca confia só no payload do JWT
// (pega desativação/mudança de cargo/fail no ato, não só no login).
export async function getSessionUser(req) {
  const token = getToken(req);
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
  const rows = await sql`SELECT * FROM users WHERE id = ${payload.sub}`;
  const u = rows[0];
  if (!u || u.status !== "ativo") return null;
  return u;
}

export async function requireAdmin(req, res) {
  return requireRole(req, res, ["Administrador"]);
}

export async function requireAuth(req, res) {
  const u = await getSessionUser(req);
  if (!u) {
    res.status(401).json({ error: "Não autenticado." });
    return null;
  }
  return u;
}

// Restringe a cargos específicos (ex.: cadastro/edição de peças e preços não
// deve ficar aberto a qualquer usuário autenticado, só a quem de fato cuida disso).
export async function requireRole(req, res, cargos) {
  const u = await getSessionUser(req);
  if (!u) {
    res.status(401).json({ error: "Não autenticado." });
    return null;
  }
  if (!cargos.includes(u.cargo)) {
    res.status(403).json({ error: "Acesso não permitido para o seu perfil." });
    return null;
  }
  return u;
}

// Em produção a Vercel preenche x-forwarded-for com o IP real do cliente.
export function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.socket?.remoteAddress || null;
}
