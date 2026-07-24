import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";

const pExecFile = promisify(execFile);

// git for handwriting: every time a doc's cloud hash changes and its bundle
// is fetched, the bundle is kept forever under data/versions/<doc>/<hash>.rmdoc
// and its per-page save-timestamps are recorded for diffing.
const BUNDLE_DIR = path.join(process.cwd(), "data", "bundles");
const VERSION_DIR = path.join(process.cwd(), "data", "versions");

type PageStamp = { id: string; modifed?: number };

export function versionBundlePath(docId: string, hash: string): string {
  return path.join(VERSION_DIR, docId, `${hash}.rmdoc`);
}

async function pagesFromBundle(bundlePath: string): Promise<PageStamp[]> {
  const { stdout } = await pExecFile("unzip", ["-p", bundlePath, "*.content"], {
    maxBuffer: 64 * 1024 * 1024,
  });
  const content = JSON.parse(stdout);
  if (Array.isArray(content?.cPages?.pages)) {
    return content.cPages.pages.map((p: { id?: string; modifed?: string }) => ({
      id: String(p.id ?? ""),
      ...(p.modifed ? { modifed: Number(p.modifed) } : {}),
    }));
  }
  if (Array.isArray(content?.pages)) {
    return content.pages.map((id: string) => ({ id }));
  }
  return [];
}

export async function captureVersion(
  docId: string,
  bundlePath: string,
  hash: string
): Promise<void> {
  const db = getDb();
  const exists = db
    .prepare("SELECT 1 FROM doc_versions WHERE doc_id = ? AND hash = ?")
    .get(docId, hash);
  if (exists) return;
  const dest = versionBundlePath(docId, hash);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(dest)) fs.copyFileSync(bundlePath, dest);
  const pages = await pagesFromBundle(dest).catch(() => [] as PageStamp[]);
  db.prepare(
    `INSERT OR IGNORE INTO doc_versions (doc_id, hash, captured_at, size_bytes, page_count, pages)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(docId, hash, Date.now(), fs.statSync(dest).size, pages.length, JSON.stringify(pages));
}

// docs downloaded before the time machine existed get their current bundle
// registered as version one, lazily, the first time their timeline is opened
export async function ensureSeeded(docId: string): Promise<void> {
  const db = getDb();
  const bundle = db
    .prepare("SELECT hash FROM bundles WHERE doc_id = ? AND error = ''")
    .get(docId) as { hash: string } | undefined;
  if (!bundle?.hash) return;
  const src = path.join(BUNDLE_DIR, `${docId}.rmdoc`);
  if (!fs.existsSync(src)) return;
  await captureVersion(docId, src, bundle.hash);
}

export type VersionEntry = {
  hash: string;
  capturedAt: number;
  sizeBytes: number;
  pageCount: number;
  added: number;
  removed: number;
  changed: number;
  changedPages: { id: string; index: number }[]; // 1-based position in this version
};

// reconstructed history: every page in the newest snapshot carries its own
// last-edited timestamp, so we can show WHEN the doc evolved even before any
// snapshots accumulated. previews for these entries render today's ink (the
// past pixels were never captured by anyone).
export type ActivityDay = {
  day: string; // e.g. "sun, jul 20"
  ts: number;
  pages: { id: string; index: number }[];
};

export async function activity(docId: string): Promise<{ latestHash: string; days: ActivityDay[] }> {
  await ensureSeeded(docId);
  const row = getDb()
    .prepare(
      `SELECT hash, pages FROM doc_versions WHERE doc_id = ? ORDER BY captured_at DESC LIMIT 1`
    )
    .get(docId) as { hash: string; pages: string } | undefined;
  if (!row) return { latestHash: "", days: [] };
  const pages = JSON.parse(row.pages) as PageStamp[];
  const byDay = new Map<string, ActivityDay>();
  pages.forEach((p, i) => {
    if (!p.modifed) return;
    const d = new Date(p.modifed);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let entry = byDay.get(key);
    if (!entry) {
      entry = {
        day: d
          .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
          .toLowerCase(),
        ts: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
        pages: [],
      };
      byDay.set(key, entry);
    }
    if (entry.pages.length < 24) entry.pages.push({ id: p.id, index: i + 1 });
  });
  const days = [...byDay.values()].sort((a, b) => b.ts - a.ts).slice(0, 90);
  return { latestHash: row.hash, days };
}

export async function timeline(docId: string): Promise<VersionEntry[]> {
  await ensureSeeded(docId);
  const rows = getDb()
    .prepare(
      `SELECT hash, captured_at, size_bytes, page_count, pages
       FROM doc_versions WHERE doc_id = ? ORDER BY captured_at ASC`
    )
    .all(docId) as {
    hash: string;
    captured_at: number;
    size_bytes: number;
    page_count: number;
    pages: string;
  }[];

  const entries: VersionEntry[] = [];
  let prev: Map<string, number | undefined> | null = null;
  for (const r of rows) {
    const pages = JSON.parse(r.pages) as PageStamp[];
    const cur = new Map(pages.map((p) => [p.id, p.modifed]));
    let added = 0;
    let removed = 0;
    const changedPages: { id: string; index: number }[] = [];
    if (prev) {
      for (const [id, modifed] of cur) {
        if (!prev.has(id)) {
          added += 1;
          changedPages.push({ id, index: pages.findIndex((p) => p.id === id) + 1 });
        } else if (prev.get(id) !== modifed) {
          changedPages.push({ id, index: pages.findIndex((p) => p.id === id) + 1 });
        }
      }
      for (const id of prev.keys()) if (!cur.has(id)) removed += 1;
    }
    entries.push({
      hash: r.hash,
      capturedAt: r.captured_at,
      sizeBytes: r.size_bytes,
      pageCount: r.page_count,
      added,
      removed,
      changed: changedPages.length - added,
      changedPages: changedPages.slice(0, 24),
    });
    prev = cur;
  }
  return entries.reverse(); // newest first, like git log
}
