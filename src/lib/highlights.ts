import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";

const pExecFile = promisify(execFile);

// Walks downloaded bundles and runs the rust wasm engine over every .rm page,
// storing extracted text highlights. Re-scans a doc only when its bundle hash
// changed since the last scan (bundles.hl_hash).
const BUNDLE_DIR = path.join(process.cwd(), "data", "bundles");

type Engine = { highlights_json(data: Uint8Array): string; engine_version(): string };
let engine: Engine | null = null;

function getEngine(): Engine {
  if (!engine) {
    // absolute-path require at runtime keeps the bundler out of it
    const req = createRequire(path.join(process.cwd(), "package.json"));
    engine = req(path.join(process.cwd(), "engine", "pkg", "ink_engine.js")) as Engine;
  }
  return engine;
}

export type ScanProgress = {
  running: boolean;
  done: number;
  total: number;
  found: number;
  finishedAt: number | null;
};

const progress: ScanProgress = {
  running: false,
  done: 0,
  total: 0,
  found: 0,
  finishedAt: null,
};

export function getScanProgress(): ScanProgress {
  return { ...progress };
}

type ParsedHighlight = { text: string; color: number };

async function scanDoc(docId: string, hash: string): Promise<number> {
  const db = getDb();
  const bundle = path.join(BUNDLE_DIR, `${docId}.rmdoc`);
  if (!fs.existsSync(bundle)) return 0;
  // list .rm page entries inside the zip
  const { stdout: listing } = await pExecFile("unzip", ["-Z1", bundle]).catch(() => ({
    stdout: "",
  }));
  const pages = listing
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.endsWith(".rm"));
  const eng = getEngine();
  let found = 0;
  const insert = db.prepare(
    "INSERT OR REPLACE INTO highlights (doc_id, page_id, ord, text, color) VALUES (?, ?, ?, ?, ?)"
  );
  db.prepare("DELETE FROM highlights WHERE doc_id = ?").run(docId);
  for (const entry of pages) {
    const pageId = path.basename(entry, ".rm");
    try {
      const { stdout } = await pExecFile("unzip", ["-p", bundle, entry], {
        encoding: "buffer",
        maxBuffer: 64 * 1024 * 1024,
      });
      const parsed = JSON.parse(eng.highlights_json(new Uint8Array(stdout as Buffer)));
      if (Array.isArray(parsed)) {
        (parsed as ParsedHighlight[]).forEach((h, i) => {
          if (h.text?.trim()) {
            insert.run(docId, pageId, i, h.text, h.color ?? 0);
            found += 1;
          }
        });
      }
    } catch {
      // a page that fails to parse shouldn't sink the whole doc
    }
  }
  db.prepare("UPDATE bundles SET hl_hash = ? WHERE doc_id = ?").run(hash, docId);
  return found;
}

export function startScan(): ScanProgress {
  if (progress.running) return getScanProgress();
  const pending = getDb()
    .prepare(
      `SELECT doc_id, hash FROM bundles
       WHERE error = '' AND hash != '' AND hl_hash != hash`
    )
    .all() as { doc_id: string; hash: string }[];
  progress.running = true;
  progress.done = 0;
  progress.total = pending.length;
  progress.found = 0;
  progress.finishedAt = null;
  void (async () => {
    for (const b of pending) {
      progress.found += await scanDoc(b.doc_id, b.hash);
      progress.done += 1;
    }
    progress.running = false;
    progress.finishedAt = Date.now();
  })();
  return getScanProgress();
}
