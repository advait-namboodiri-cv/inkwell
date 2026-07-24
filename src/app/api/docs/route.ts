import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

// doc search for pickers (summarize, later worksheets/sketches)
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ docs: [] });
  const docs = getDb()
    .prepare(
      `SELECT id, name, path, page_count, file_type FROM documents
       WHERE type = 'DocumentType' AND deleted = 0 AND name LIKE ? ESCAPE '\\'
       ORDER BY last_modified DESC LIMIT 8`
    )
    .all(`%${q.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
  return NextResponse.json({ docs });
}
