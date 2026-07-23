import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getScanProgress, startScan } from "@/lib/highlights";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(startScan());
}

export async function GET() {
  const db = getDb();
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS passages, COUNT(DISTINCT h.doc_id) AS books
       FROM highlights h`
    )
    .get() as { passages: number; books: number };

  const rows = db
    .prepare(
      `SELECT h.text, h.color, d.name AS doc, d.last_modified
       FROM highlights h JOIN documents d ON d.id = h.doc_id
       WHERE d.deleted = 0
       ORDER BY d.last_modified DESC, h.doc_id, h.page_id, h.ord
       LIMIT 60`
    )
    .all() as { text: string; color: number; doc: string; last_modified: number }[];

  // passage of the day: deterministic pick, same all day
  let daily = null;
  if (totals.passages > 0) {
    const dayNumber = Math.floor(Date.now() / 86_400_000);
    const all = db
      .prepare(
        `SELECT h.text, d.name AS doc FROM highlights h
         JOIN documents d ON d.id = h.doc_id WHERE d.deleted = 0
         ORDER BY h.doc_id, h.page_id, h.ord`
      )
      .all() as { text: string; doc: string }[];
    if (all.length > 0) daily = all[dayNumber % all.length];
  }

  return NextResponse.json({ totals, recent: rows, daily, scan: getScanProgress() });
}
