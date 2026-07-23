import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb, setSyncState, getSyncState } from "./db";
import { runRmapi } from "./rmapi";

// The metadata sweep reads rmapi's local tree cache: one `rmapi refresh`
// pulls the whole account tree (name, parent, timestamps, pageCount, tags,
// sizes, per-doc hash) — seconds, instead of ~900 individual stat calls.
// The cache format is rmapi-internal (pinned to v0.0.34); if it ever
// changes shape, parseCache throws and sync surfaces a clear error.
const TREE_CACHE = path.join(os.homedir(), "Library", "Caches", "rmapi", "tree.cache");

type CacheDoc = {
  DocumentID: string;
  Hash: string;
  Size: number;
  Metadata?: {
    visibleName?: string;
    type?: string;
    parent?: string;
    lastModified?: string;
    lastOpened?: string;
    lastOpenedPage?: number;
    pinned?: boolean;
    deleted?: boolean;
  };
  Content?: {
    fileType?: string;
    pageCount?: number;
    tags?: { name?: string }[] | string[];
  };
};

export type SyncProgress = {
  running: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  docCount: number;
  generation: string | null;
  error: string | null;
};

const progress: SyncProgress = {
  running: false,
  startedAt: null,
  finishedAt: null,
  docCount: 0,
  generation: null,
  error: null,
};

export function getSyncProgress(): SyncProgress {
  return { ...progress };
}

export function lastSyncedAt(): number {
  const v = getSyncState("last_synced_at");
  return v ? Number(v) : 0;
}

function parseCache(): { generation: string; docs: CacheDoc[] } {
  const raw = JSON.parse(fs.readFileSync(TREE_CACHE, "utf8"));
  if (!Array.isArray(raw.Docs)) throw new Error("unexpected tree.cache shape");
  return { generation: String(raw.Generation ?? ""), docs: raw.Docs as CacheDoc[] };
}

function computePaths(docs: CacheDoc[]): Map<string, string> {
  const byId = new Map(docs.map((d) => [d.DocumentID, d]));
  const memo = new Map<string, string>();
  const resolve = (id: string, depth = 0): string => {
    if (memo.has(id)) return memo.get(id)!;
    const doc = byId.get(id);
    if (!doc || depth > 50) return "";
    const name = doc.Metadata?.visibleName ?? doc.DocumentID;
    const parent = doc.Metadata?.parent ?? "";
    const base =
      parent === "" || parent === "trash" || !byId.has(parent)
        ? parent === "trash"
          ? "/trash"
          : ""
        : resolve(parent, depth + 1);
    const full = `${base}/${name}`;
    memo.set(id, full);
    return full;
  };
  for (const d of docs) resolve(d.DocumentID);
  return memo;
}

export async function runSync(): Promise<SyncProgress> {
  if (progress.running) return getSyncProgress();
  progress.running = true;
  progress.startedAt = Date.now();
  progress.finishedAt = null;
  progress.error = null;
  try {
    const res = await runRmapi(["refresh"], undefined, 120_000);
    if (res.code !== 0) throw new Error("refresh failed — is the connection ok?");
    const { generation, docs } = parseCache();
    const paths = computePaths(docs);
    const db = getDb();
    const now = Date.now();
    const upsert = db.prepare(`
      INSERT INTO documents
        (id, name, type, parent, path, deleted, pinned, file_type, page_count,
         current_page, last_modified, last_opened, size_bytes, hash, tags, synced_at)
      VALUES
        (@id, @name, @type, @parent, @path, @deleted, @pinned, @file_type, @page_count,
         @current_page, @last_modified, @last_opened, @size_bytes, @hash, @tags, @synced_at)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name, type = excluded.type, parent = excluded.parent,
        path = excluded.path, deleted = excluded.deleted, pinned = excluded.pinned,
        file_type = excluded.file_type, page_count = excluded.page_count,
        current_page = excluded.current_page, last_modified = excluded.last_modified,
        last_opened = excluded.last_opened, size_bytes = excluded.size_bytes,
        hash = excluded.hash, tags = excluded.tags, synced_at = excluded.synced_at
    `);
    const sweep = db.transaction((items: CacheDoc[]) => {
      for (const d of items) {
        const m = d.Metadata ?? {};
        const c = d.Content ?? {};
        const tags = Array.isArray(c.tags)
          ? c.tags.map((t) => (typeof t === "string" ? t : (t?.name ?? ""))).filter(Boolean)
          : [];
        const docPath = paths.get(d.DocumentID) ?? `/${m.visibleName ?? d.DocumentID}`;
        // trashed = directly in trash OR nested anywhere under a trashed folder
        const trashed =
          m.deleted || m.parent === "trash" || docPath.startsWith("/trash/");
        upsert.run({
          id: d.DocumentID,
          name: m.visibleName ?? d.DocumentID,
          type: m.type ?? "DocumentType",
          parent: m.parent ?? "",
          path: docPath,
          deleted: trashed ? 1 : 0,
          pinned: m.pinned ? 1 : 0,
          file_type: c.fileType ?? "",
          page_count: c.pageCount ?? 0,
          current_page: m.lastOpenedPage ?? 0,
          last_modified: Number(m.lastModified ?? 0),
          last_opened: Number(m.lastOpened ?? 0),
          size_bytes: d.Size ?? 0,
          hash: d.Hash ?? "",
          tags: JSON.stringify(tags),
          synced_at: now,
        });
      }
      // anything not seen this sweep no longer exists in the cloud
      db.prepare("DELETE FROM documents WHERE synced_at < ?").run(now);
    });
    sweep(docs);
    progress.docCount = docs.length;
    progress.generation = generation;
    setSyncState("last_synced_at", String(now));
    setSyncState("generation", generation);
  } catch (err) {
    progress.error = err instanceof Error ? err.message : String(err);
  } finally {
    progress.running = false;
    progress.finishedAt = Date.now();
  }
  return getSyncProgress();
}
