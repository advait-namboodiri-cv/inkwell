import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { lastSyncedAt } from "@/lib/sync";

export const runtime = "nodejs";

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 182;
const WEEK_MS = 1000 * 60 * 60 * 24 * 7;

export async function GET() {
  if (!lastSyncedAt()) {
    return NextResponse.json({ error: "not synced yet" }, { status: 409 });
  }
  const db = getDb();
  const now = Date.now();

  const totals = db
    .prepare(
      `SELECT
         SUM(CASE WHEN type = 'DocumentType' AND deleted = 0 THEN 1 ELSE 0 END) AS docs,
         SUM(CASE WHEN type = 'CollectionType' AND deleted = 0 THEN 1 ELSE 0 END) AS folders,
         SUM(CASE WHEN deleted = 1 THEN 1 ELSE 0 END) AS trashed,
         SUM(CASE WHEN deleted = 0 THEN size_bytes ELSE 0 END) AS bytes
       FROM documents`
    )
    .get() as { docs: number; folders: number; trashed: number; bytes: number };

  const typeMix = db
    .prepare(
      `SELECT CASE WHEN file_type IN ('pdf','epub') THEN file_type ELSE 'notebook' END AS kind,
              COUNT(*) AS n
       FROM documents WHERE type = 'DocumentType' AND deleted = 0
       GROUP BY kind ORDER BY n DESC`
    )
    .all() as { kind: string; n: number }[];

  const biggestFolders = db
    .prepare(
      `SELECT f.name AS name, COUNT(d.id) AS n
       FROM documents f
       JOIN documents d ON d.parent = f.id AND d.type = 'DocumentType' AND d.deleted = 0
       WHERE f.type = 'CollectionType' AND f.deleted = 0
       GROUP BY f.id ORDER BY n DESC LIMIT 5`
    )
    .all() as { name: string; n: number }[];

  const staleCount = db
    .prepare(
      `SELECT COUNT(*) AS n FROM documents
       WHERE type = 'DocumentType' AND deleted = 0 AND last_modified > 0 AND last_modified < ?`
    )
    .get(now - SIX_MONTHS_MS) as { n: number };

  const activeWeek = db
    .prepare(
      `SELECT COUNT(*) AS n FROM documents
       WHERE type = 'DocumentType' AND deleted = 0 AND last_modified >= ?`
    )
    .get(now - WEEK_MS) as { n: number };

  const oldest = db
    .prepare(
      `SELECT name, last_modified FROM documents
       WHERE type = 'DocumentType' AND deleted = 0 AND last_modified > 0
       ORDER BY last_modified ASC LIMIT 1`
    )
    .get() as { name: string; last_modified: number } | undefined;

  return NextResponse.json({
    totals,
    typeMix,
    biggestFolders,
    staleCount: staleCount.n,
    activeWeek: activeWeek.n,
    oldest: oldest ?? null,
    lastSyncedAt: lastSyncedAt(),
  });
}
