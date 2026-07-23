import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// one local file, ./data is gitignored
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "inkwell.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      type          TEXT NOT NULL,          -- DocumentType | CollectionType
      parent        TEXT NOT NULL,          -- '' root, 'trash', or folder id
      path          TEXT NOT NULL,          -- computed full path, e.g. /CALC 3/lHopital
      deleted       INTEGER NOT NULL DEFAULT 0,
      pinned        INTEGER NOT NULL DEFAULT 0,
      file_type     TEXT NOT NULL DEFAULT '',   -- pdf | epub | '' (notebook)
      page_count    INTEGER NOT NULL DEFAULT 0,
      current_page  INTEGER NOT NULL DEFAULT 0, -- 0-indexed lastOpenedPage
      last_modified INTEGER NOT NULL DEFAULT 0, -- epoch ms
      last_opened   INTEGER NOT NULL DEFAULT 0, -- epoch ms
      size_bytes    INTEGER NOT NULL DEFAULT 0,
      hash          TEXT NOT NULL DEFAULT '',   -- per-doc content hash (change detection)
      tags          TEXT NOT NULL DEFAULT '[]', -- json array
      synced_at     INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_documents_parent ON documents(parent);
    CREATE INDEX IF NOT EXISTS idx_documents_modified ON documents(last_modified);
    CREATE TABLE IF NOT EXISTS sync_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return db;
}

export function getSyncState(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM sync_state WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSyncState(key: string, value: string): void {
  getDb()
    .prepare(
      "INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(key, value);
}
