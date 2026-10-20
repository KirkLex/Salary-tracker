import { send, userFromRequest } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Метод не поддерживается" });
  try {
    const user = await userFromRequest(req);
    return send(res, 200, { user: user || null });
  } catch {
    return send(res, 500, { error: "Не удалось проверить вход" });
  }
}
