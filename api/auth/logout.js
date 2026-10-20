import { clearSessionCookie, cookie, send } from "../lib/auth.js";
import { db, ensureSchema } from "../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Метод не поддерживается" });
  try {
    await ensureSchema();
    const token = cookie(req, "session");
    if (token) await db()`DELETE FROM sessions WHERE token = ${token}`;
    clearSessionCookie(res);
    return send(res, 200, { ok: true });
  } catch {
    return send(res, 500, { error: "Не удалось выйти" });
  }
}
