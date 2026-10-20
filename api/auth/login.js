import { checkPassword, createSession, readJson, send, validEmail } from "../lib/auth.js";
import { db, ensureSchema } from "../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Метод не поддерживается" });
  try {
    const body = await readJson(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!validEmail(email) || !password) return send(res, 400, { error: "Введите почту и пароль" });
    await ensureSchema();
    const rows = await db()`SELECT id, email, password_hash FROM users WHERE email = ${email}`;
    const user = rows[0];
    if (!user || !(await checkPassword(password, user.password_hash))) {
      return send(res, 401, { error: "Неверная почта или пароль" });
    }
    await createSession(res, user.id);
    return send(res, 200, { user: { id: user.id, email: user.email } });
  } catch {
    return send(res, 500, { error: "Не удалось войти" });
  }
}
