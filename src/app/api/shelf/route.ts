import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { lastSyncedAt } from "@/lib/sync";

export const runtime = "nodejs";

// "books in flight": book-shaped documents (pdf/epub with a real page count)
// that have been opened somewhere past the start and touched in the last year
const YEAR_MS = 1000 * 60 * 60 * 24 * 365;

export async function GET() {
  if (!lastSyncedAt()) {
    return NextResponse.json({ error: "not synced yet" }, { status: 409 });
  }
  const rows = getDb()
    .prepare(
      `SELECT name, file_type, page_count, current_page, last_opened
       FROM documents
       WHERE type = 'DocumentType' AND deleted = 0
         AND file_type IN ('pdf','epub')
         AND page_count >= 40
         AND current_page > 0
         AND last_opened >= ?
       ORDER BY last_opened DESC
       LIMIT 8`
    )
    .all(Date.now() - YEAR_MS) as {
    name: string;
    file_type: string;
    page_count: number;
    current_page: number;
    last_opened: number;
  }[];

  const shelf = rows.map((r) => ({
    name: r.name,
    fileType: r.file_type,
    page: r.current_page + 1, // 0-indexed → human
    pageCount: r.page_count,
    percent: Math.min(100, Math.round(((r.current_page + 1) / r.page_count) * 100)),
    lastOpened: r.last_opened,
  }));

  return NextResponse.json({ shelf });
}
