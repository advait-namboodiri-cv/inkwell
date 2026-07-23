import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export type Todo = { id: number; text: string; done: number; created_at: number };

export async function GET() {
  const todos = getDb()
    .prepare("SELECT id, text, done, created_at FROM todos ORDER BY done ASC, id DESC")
    .all() as Todo[];
  return NextResponse.json({ todos });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 300) : "";
  if (!text) return NextResponse.json({ error: "empty todo" }, { status: 400 });
  getDb().prepare("INSERT INTO todos (text, done, created_at) VALUES (?, 0, ?)").run(text, Date.now());
  return GET();
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== "number") return NextResponse.json({ error: "id required" }, { status: 400 });
  getDb().prepare("UPDATE todos SET done = ? WHERE id = ?").run(body.done ? 1 : 0, body.id);
  return GET();
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  getDb().prepare("DELETE FROM todos WHERE id = ?").run(id);
  return GET();
}
