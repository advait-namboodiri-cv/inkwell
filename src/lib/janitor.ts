import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb } from "./db";
import { runRmapi } from "./rmapi";

// The janitor never hard-loses data: before any cloud delete, the doc's full
// bundle is copied into data/vault/<id>__<name>.rmdoc. Disk is cheap; regret isn't.
const BUNDLE_DIR = path.join(process.cwd(), "data", "bundles");
const VAULT_DIR = path.join(process.cwd(), "data", "vault");

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 182;

export type JanitorDoc = {
  id: string;
  name: string;
  path: string;
  last_modified: number;
  size_bytes: number;
  page_count: number;
};

export function janitorReport() {
  const db = getDb();
  const stale = db
    .prepare(
      `SELECT id, name, path, last_modified, size_bytes, page_count FROM documents
       WHERE type = 'DocumentType' AND deleted = 0
         AND last_modified > 0 AND last_modified < ?
       ORDER BY last_modified ASC LIMIT 100`
    )
    .all(Date.now() - SIX_MONTHS_MS) as JanitorDoc[];

  const dupeGroups = db
    .prepare(
      `SELECT LOWER(name) AS key FROM documents
       WHERE type = 'DocumentType' AND deleted = 0
       GROUP BY LOWER(name) HAVING COUNT(*) > 1
       ORDER BY COUNT(*) DESC LIMIT 30`
    )
    .all() as { key: string }[];
  const dupeRows = db.prepare(
    `SELECT id, name, path, last_modified, size_bytes, page_count FROM documents
     WHERE type = 'DocumentType' AND deleted = 0 AND LOWER(name) = ?
     ORDER BY last_modified DESC`
  );
  const dupes = dupeGroups.map((g) => ({
    name: g.key,
    docs: dupeRows.all(g.key) as JanitorDoc[],
  }));

  const orphans = db
    .prepare(
      `SELECT id, name, path, last_modified, size_bytes, page_count FROM documents d
       WHERE deleted = 0 AND parent NOT IN ('', 'trash')
         AND NOT EXISTS (SELECT 1 FROM documents p WHERE p.id = d.parent)
       ORDER BY last_modified DESC LIMIT 50`
    )
    .all() as JanitorDoc[];

  const staleTotal = db
    .prepare(
      `SELECT COUNT(*) AS n FROM documents
       WHERE type = 'DocumentType' AND deleted = 0
         AND last_modified > 0 AND last_modified < ?`
    )
    .get(Date.now() - SIX_MONTHS_MS) as { n: number };

  return { stale, staleTotal: staleTotal.n, dupes, orphans };
}

function sanitize(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 80);
}

async function ensureBundle(id: string, docPath: string): Promise<string> {
  const bundle = path.join(BUNDLE_DIR, `${id}.rmdoc`);
  if (fs.existsSync(bundle)) return bundle;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "inkwell-vault-"));
  try {
    const res = await runRmapi(["get", docPath], undefined, 180_000, tmp);
    if (res.code !== 0) throw new Error(`couldn't download before delete: ${res.stderr.slice(0, 150)}`);
    const produced = fs.readdirSync(tmp).find((f) => f.endsWith(".rmdoc"));
    if (!produced) throw new Error("no bundle produced");
    fs.mkdirSync(BUNDLE_DIR, { recursive: true });
    fs.copyFileSync(path.join(tmp, produced), bundle);
    return bundle;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export type RemoveResult = { id: string; ok: boolean; error?: string };

export async function removeDocs(ids: string[]): Promise<RemoveResult[]> {
  const db = getDb();
  const byId = db.prepare(
    "SELECT id, name, path FROM documents WHERE id = ? AND deleted = 0"
  );
  const results: RemoveResult[] = [];
  for (const id of ids) {
    const doc = byId.get(id) as { id: string; name: string; path: string } | undefined;
    if (!doc) {
      results.push({ id, ok: false, error: "not found" });
      continue;
    }
    try {
      // 1) archive to the vault
      const bundle = await ensureBundle(doc.id, doc.path);
      fs.mkdirSync(VAULT_DIR, { recursive: true });
      fs.copyFileSync(bundle, path.join(VAULT_DIR, `${doc.id}__${sanitize(doc.name)}.rmdoc`));
      // 2) delete from the cloud
      const res = await runRmapi(["rm", doc.path], undefined, 60_000);
      if (res.code !== 0) throw new Error(`cloud delete failed: ${res.stderr.slice(0, 150)}`);
      // 3) reflect locally right away
      db.prepare("UPDATE documents SET deleted = 1 WHERE id = ?").run(doc.id);
      results.push({ id, ok: true });
    } catch (err) {
      results.push({
        id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
