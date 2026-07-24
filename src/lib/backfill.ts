import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb } from "./db";
import { runRmapi } from "./rmapi";
import { captureVersion } from "./versions";

const pExecFile = promisify(execFile);

// Downloads each document's bundle (.rmdoc) once per cloud version, keeps it
// in data/bundles/<doc_id>.rmdoc (fuel for highlights, vault and time machine),
// and harvests per-page annotation timestamps into page_events for the heatmap.
const BUNDLE_DIR = path.join(process.cwd(), "data", "bundles");

export type BackfillProgress = {
  running: boolean;
  done: number;
  total: number;
  currentDoc: string | null;
  failed: number;
  finishedAt: number | null;
};

const progress: BackfillProgress = {
  running: false,
  done: 0,
  total: 0,
  currentDoc: null,
  failed: 0,
  finishedAt: null,
};

export function getBackfillProgress(): BackfillProgress {
  return { ...progress };
}

type PendingDoc = { id: string; path: string; hash: string };

function pendingDocs(): PendingDoc[] {
  return getDb()
    .prepare(
      `SELECT d.id, d.path, d.hash FROM documents d
       LEFT JOIN bundles b ON b.doc_id = d.id
       WHERE d.type = 'DocumentType' AND d.deleted = 0
         AND (b.doc_id IS NULL OR b.hash != d.hash)
       ORDER BY d.last_modified DESC`
    )
    .all() as PendingDoc[];
}

type ContentPage = { id?: string; modifed?: string };

async function harvestPageEvents(docId: string, bundlePath: string): Promise<void> {
  const db = getDb();
  // an .rmdoc is a zip; pull just the .content json out of it
  const { stdout } = await pExecFile("unzip", ["-p", bundlePath, "*.content"], {
    maxBuffer: 64 * 1024 * 1024,
  });
  const content = JSON.parse(stdout);
  // per-page timestamps only exist in formatVersion 2 (cPages); v1 epubs have none
  const pages: ContentPage[] = content?.cPages?.pages ?? [];
  const insert = db.prepare(
    "INSERT OR IGNORE INTO page_events (doc_id, page_id, modifed) VALUES (?, ?, ?)"
  );
  const tx = db.transaction((rows: ContentPage[]) => {
    for (const p of rows) {
      if (p.id && p.modifed) insert.run(docId, p.id, Number(p.modifed));
    }
  });
  tx(pages.filter((p) => p.modifed));
}

async function fetchOne(doc: PendingDoc): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "inkwell-get-"));
  try {
    const res = await runRmapi(["get", doc.path], undefined, 180_000, tmp);
    if (res.code !== 0) throw new Error(`get failed: ${res.stderr.slice(0, 200)}`);
    const produced = fs.readdirSync(tmp).find((f) => f.endsWith(".rmdoc"));
    if (!produced) throw new Error("no .rmdoc produced");
    fs.mkdirSync(BUNDLE_DIR, { recursive: true });
    const dest = path.join(BUNDLE_DIR, `${doc.id}.rmdoc`);
    fs.copyFileSync(path.join(tmp, produced), dest);
    await harvestPageEvents(doc.id, dest);
    await captureVersion(doc.id, dest, doc.hash); // time machine snapshot
    getDb()
      .prepare(
        `INSERT INTO bundles (doc_id, hash, fetched_at, error) VALUES (?, ?, ?, '')
         ON CONFLICT(doc_id) DO UPDATE SET hash = excluded.hash,
           fetched_at = excluded.fetched_at, error = ''`
      )
      .run(doc.id, doc.hash, Date.now());
  } catch (err) {
    progress.failed += 1;
    getDb()
      .prepare(
        `INSERT INTO bundles (doc_id, hash, fetched_at, error) VALUES (?, '', ?, ?)
         ON CONFLICT(doc_id) DO UPDATE SET fetched_at = excluded.fetched_at,
           error = excluded.error`
      )
      .run(doc.id, Date.now(), err instanceof Error ? err.message : String(err));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export function startBackfill(): BackfillProgress {
  if (progress.running) return getBackfillProgress();
  const queue = pendingDocs();
  progress.running = true;
  progress.done = 0;
  progress.total = queue.length;
  progress.failed = 0;
  progress.finishedAt = null;
  void (async () => {
    for (const doc of queue) {
      progress.currentDoc = doc.path;
      await fetchOne(doc);
      progress.done += 1;
    }
    progress.running = false;
    progress.currentDoc = null;
    progress.finishedAt = Date.now();
  })();
  return getBackfillProgress();
}
