import { readJson, send, userFromRequest } from "./lib/auth.js";
import { db } from "./lib/db.js";

export default async function handler(req, res) {
  try {
    const user = await userFromRequest(req);
    if (!user) return send(res, 401, { error: "Нужно войти" });
    const sql = db();
    if (req.method === "GET") {
      const rows = await sql`SELECT data FROM ledgers WHERE user_id = ${user.id}`;
      return send(res, 200, { ledger: rows[0]?.data || null });
    }
    if (req.method === "PUT") {
      const body = await readJson(req);
      if (!body.ledger || typeof body.ledger !== "object" || Array.isArray(body.ledger)) {
        return send(res, 400, { error: "Нет данных учёта" });
      }
      const payload = JSON.stringify(body.ledger);
      if (payload.length > 900_000) return send(res, 413, { error: "Слишком большой учёт" });
      await sql`INSERT INTO ledgers (user_id, data)
        VALUES (${user.id}, ${body.ledger}::jsonb)
        ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: "Метод не поддерживается" });
  } catch {
    return send(res, 500, { error: "Не удалось сохранить учёт" });
  }
}
