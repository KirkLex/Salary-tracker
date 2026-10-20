import { neon } from "@neondatabase/serverless";

let ready;

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export function ensureSchema() {
  if (!ready) {
    const sql = db();
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY,
        email text UNIQUE NOT NULL,
        password_hash text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS sessions (
        token text PRIMARY KEY,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS ledgers (
        user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
    })();
  }
  return ready;
}
