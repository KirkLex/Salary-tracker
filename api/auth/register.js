import { randomUUID } from "node:crypto";
import { db, ensureSchema } from "../lib/db.js";
import { createSession, hashPassword, readJson, send, validEmail } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Метод не поддерживается" });
  try {
    const body = await readJson(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!validEmail(email)) return send(res, 400, { error: "Введите почту, например name@mail.com" });
    if (password.length < 8 || password.length > 72) return send(res, 400, { error: "Пароль должен быть от 8 до 72 символов" });
    await ensureSchema();
    const sql = db();
    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length) return send(res, 409, { error: "Такая почта уже зарегистрирована" });
    const id = randomUUID();
    const passwordHash = await hashPassword(password);
    await sql`INSERT INTO users (id, email, password_hash) VALUES (${id}, ${email}, ${passwordHash})`;
    await createSession(res, id);
    return send(res, 201, { user: { id, email } });
  } catch {
    return send(res, 500, { error: "Не удалось создать аккаунт" });
  }
}
