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
    -- one row per (page, save-timestamp) ever observed; history accumulates
    -- across syncs even though the device only keeps a page's latest 'modifed'
    CREATE TABLE IF NOT EXISTS page_events (
      doc_id  TEXT NOT NULL,
      page_id TEXT NOT NULL,
      modifed INTEGER NOT NULL,
      PRIMARY KEY (doc_id, page_id, modifed)
    );
    CREATE INDEX IF NOT EXISTS idx_page_events_modifed ON page_events(modifed);
    -- which bundle version we last downloaded per doc (hash = cloud content hash)
    CREATE TABLE IF NOT EXISTS bundles (
      doc_id     TEXT PRIMARY KEY,
      hash       TEXT NOT NULL,
      fetched_at INTEGER NOT NULL,
      error      TEXT NOT NULL DEFAULT ''
    );
    -- the todos page (also printed on the daily brief)
    CREATE TABLE IF NOT EXISTS todos (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      text       TEXT NOT NULL,
      done       INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    -- time machine: one row per (doc, content-hash) snapshot ever captured;
    -- the bundle bytes live in data/versions/<doc_id>/<hash>.rmdoc
    CREATE TABLE IF NOT EXISTS doc_versions (
      doc_id      TEXT NOT NULL,
      hash        TEXT NOT NULL,
      captured_at INTEGER NOT NULL,
      size_bytes  INTEGER NOT NULL DEFAULT 0,
      page_count  INTEGER NOT NULL DEFAULT 0,
      pages       TEXT NOT NULL DEFAULT '[]',  -- json [{id, modifed}]
      PRIMARY KEY (doc_id, hash)
    );
    -- every ai generation, for the spend meter (cost_cents = 0 for local)
    CREATE TABLE IF NOT EXISTS ai_spend (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at    INTEGER NOT NULL,
      feature       TEXT NOT NULL,           -- summary | worksheet | sketch
      provider      TEXT NOT NULL,           -- local | anthropic
      model         TEXT NOT NULL,
      input_tokens  INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost_cents    REAL NOT NULL DEFAULT 0
    );
    -- cached document summaries, frozen per content hash (currents-style)
    CREATE TABLE IF NOT EXISTS summaries (
      doc_id     TEXT PRIMARY KEY,
      hash       TEXT NOT NULL,              -- bundle hash the summary was made from
      summary    TEXT NOT NULL,
      provider   TEXT NOT NULL,
      model      TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    -- text highlights parsed from .rm pages by the rust engine
    CREATE TABLE IF NOT EXISTS highlights (
      doc_id  TEXT NOT NULL,
      page_id TEXT NOT NULL,
      ord     INTEGER NOT NULL,
      text    TEXT NOT NULL,
      color   INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (doc_id, page_id, ord)
    );
  `);
  // migration: track which bundle version highlights were scanned from
  try {
    db.exec("ALTER TABLE bundles ADD COLUMN hl_hash TEXT NOT NULL DEFAULT ''");
  } catch {
    /* column already exists */
  }
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
