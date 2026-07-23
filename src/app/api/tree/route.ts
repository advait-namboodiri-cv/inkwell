import { NextResponse } from "next/server";
import { isPaired, runRmapi } from "@/lib/rmapi";

export const runtime = "nodejs";

export type TreeEntry = { type: "d" | "f"; path: string };

export async function GET() {
  if (!isPaired()) {
    return NextResponse.json({ error: "not paired" }, { status: 401 });
  }
  // full recursive listing; generous timeout for large libraries
  const res = await runRmapi(["find", "/"], undefined, 120_000);
  if (res.code !== 0) {
    return NextResponse.json({ error: "sync failed" }, { status: 502 });
  }
  const entries: TreeEntry[] = res.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\[[df]\]\s/.test(l))
    .map((l) => ({
      type: l[1] as "d" | "f",
      path: l.replace(/^\[[df]\]\s+/, ""),
    }))
    .filter((e) => e.path !== "/");
  const docs = entries.filter((e) => e.type === "f").length;
  const folders = entries.filter((e) => e.type === "d").length;
  const topLevel = entries.filter((e) => e.path.split("/").length === 2);
  return NextResponse.json({ docs, folders, topLevel });
}
