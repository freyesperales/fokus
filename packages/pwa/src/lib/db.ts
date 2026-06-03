/**
 * SQLite-backed store for pair codes + configs.
 *
 * Schema:
 *   pairs(code TEXT PK, key_hash TEXT, created_at INT, config TEXT NULLABLE)
 *   rate(ip TEXT, ts INT)  -- pair-create rate limit
 *
 * The DB file lives at packages/pwa/fokus.db. In production, point it at a writable path
 * via FOKUS_DB env var.
 */
import Database from "better-sqlite3";
import { join } from "node:path";

let _db: Database.Database | null = null;

function dbPath(): string {
  return process.env.FOKUS_DB ?? join(process.cwd(), "fokus.db");
}

export function db(): Database.Database {
  if (_db) return _db;
  _db = new Database(dbPath());
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS pairs (
      code TEXT PRIMARY KEY,
      key_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      config TEXT
    );
    CREATE INDEX IF NOT EXISTS pairs_created ON pairs(created_at);

    CREATE TABLE IF NOT EXISTS rate (
      ip TEXT NOT NULL,
      ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS rate_ip ON rate(ip, ts);
  `);
  return _db;
}

export function purgeExpired(ttlMs: number): void {
  const cutoff = Date.now() - ttlMs;
  db().prepare("DELETE FROM pairs WHERE created_at < ? AND config IS NULL").run(cutoff);
  // Claimed pairs (config != null) live indefinitely.
  db().prepare("DELETE FROM rate WHERE ts < ?").run(Date.now() - 60 * 60 * 1000);
}
