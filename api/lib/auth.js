import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db, ensureSchema } from "./db.js";

const scryptAsync = promisify(scrypt);
const MONTH = 60 * 60 * 24 * 30;

export function readJson(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

export function send(res, status, body) {
  res.status(status).json(body);
}

export function cookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export function setSessionCookie(res, token) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  res.setHeader("Set-Cookie", `session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MONTH}${secure}`);
}

export function clearSessionCookie(res) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  res.setHeader("Set-Cookie", `session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
}

export function validEmail(email) {
  return typeof email === "string" && email.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export async function checkPassword(password, stored) {
  const [kind, salt, hash] = String(stored || "").split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const next = (await scryptAsync(password, salt, 64)).toString("hex");
  const left = Buffer.from(hash, "hex");
  const right = Buffer.from(next, "hex");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function userFromRequest(req) {
  await ensureSchema();
  const token = cookie(req, "session");
  if (!token) return null;
  const sql = db();
  const rows = await sql`SELECT users.id, users.email
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ${token} AND sessions.expires_at > now()`;
  return rows[0] || null;
}

export async function createSession(res, userId) {
  const token = randomBytes(32).toString("hex");
  const sql = db();
  await sql`INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${userId}, now() + interval '30 days')`;
  setSessionCookie(res, token);
}
