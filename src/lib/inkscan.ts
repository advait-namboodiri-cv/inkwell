import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";

const pExecFile = promisify(execFile);
const BUNDLE_DIR = path.join(process.cwd(), "data", "bundles");

// reMarkable canvas units → millimeters (1404 px across a 226 dpi screen)
const MM_PER_UNIT = 25.4 / 226;

type Engine = { strokes_json(data: Uint8Array): string };
let engine: Engine | null = null;
function getEngine(): Engine {
  if (!engine) {
    const req = createRequire(path.join(process.cwd(), "package.json"));
    engine = req(path.join(process.cwd(), "engine", "pkg", "ink_engine.js")) as Engine;
  }
  return engine;
}

type Stroke = {
  tool: number;
  points: number;
  distance: number;
  pressure_sum: number;
  speed_sum: number;
};

export type InkScanProgress = {
  running: boolean;
  done: number;
  total: number;
  finishedAt: number | null;
};

const progress: InkScanProgress = { running: false, done: 0, total: 0, finishedAt: null };

export function getInkScanProgress(): InkScanProgress {
  return { ...progress };
}

async function scanDoc(docId: string, hash: string): Promise<void> {
  const db = getDb();
  const bundle = path.join(BUNDLE_DIR, `${docId}.rmdoc`);
  if (!fs.existsSync(bundle)) return;
  const { stdout: listing } = await pExecFile("unzip", ["-Z1", bundle]).catch(() => ({
    stdout: "",
  }));
  const pages = listing
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.endsWith(".rm"));
  const eng = getEngine();
  let strokes = 0;
  let points = 0;
  let distance = 0;
  let pressureSum = 0;
  let speedSum = 0;
  const tools: Record<string, number> = {};
  for (const entry of pages) {
    try {
      const { stdout } = await pExecFile("unzip", ["-p", bundle, entry], {
        encoding: "buffer",
        maxBuffer: 64 * 1024 * 1024,
      });
      const parsed = JSON.parse(eng.strokes_json(new Uint8Array(stdout as Buffer)));
      if (!Array.isArray(parsed)) continue;
      for (const s of parsed as Stroke[]) {
        strokes += 1;
        points += s.points;
        distance += s.distance;
        pressureSum += s.pressure_sum;
        speedSum += s.speed_sum;
        tools[s.tool] = (tools[s.tool] ?? 0) + 1;
      }
    } catch {
      /* one bad page shouldn't sink the doc */
    }
  }
  db.prepare(
    `INSERT INTO ink_stats (doc_id, strokes, points, distance_mm, pressure_avg, speed_avg, tools, scanned_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(doc_id) DO UPDATE SET strokes = excluded.strokes, points = excluded.points,
       distance_mm = excluded.distance_mm, pressure_avg = excluded.pressure_avg,
       speed_avg = excluded.speed_avg, tools = excluded.tools, scanned_at = excluded.scanned_at`
  ).run(
    docId,
    strokes,
    points,
    distance * MM_PER_UNIT,
    points > 0 ? pressureSum / points / 255 : 0,
    points > 0 ? speedSum / points : 0,
    JSON.stringify(tools),
    Date.now()
  );
  db.prepare("UPDATE bundles SET ink_hash = ? WHERE doc_id = ?").run(hash, docId);
}

export function startInkScan(): InkScanProgress {
  if (progress.running) return getInkScanProgress();
  const pending = getDb()
    .prepare(
      `SELECT doc_id, hash FROM bundles WHERE error = '' AND hash != '' AND ink_hash != hash`
    )
    .all() as { doc_id: string; hash: string }[];
  progress.running = true;
  progress.done = 0;
  progress.total = pending.length;
  progress.finishedAt = null;
  void (async () => {
    for (const b of pending) {
      await scanDoc(b.doc_id, b.hash);
      progress.done += 1;
    }
    progress.running = false;
    progress.finishedAt = Date.now();
  })();
  return getInkScanProgress();
}

const TOOL_NAMES: Record<string, string> = {
  "0": "paintbrush",
  "12": "paintbrush",
  "1": "pencil",
  "14": "pencil",
  "2": "ballpoint",
  "15": "ballpoint",
  "3": "marker",
  "16": "marker",
  "4": "fineliner",
  "17": "fineliner",
  "5": "highlighter",
  "18": "highlighter",
  "6": "eraser",
  "8": "eraser",
  "7": "mech pencil",
  "13": "mech pencil",
  "21": "calligraphy",
  "23": "shader",
};

export function inkReport() {
  const db = getDb();
  const totals = db
    .prepare(
      `SELECT COALESCE(SUM(strokes),0) AS strokes, COALESCE(SUM(points),0) AS points,
              COALESCE(SUM(distance_mm),0) AS mm,
              COALESCE(SUM(pressure_avg * points),0) / MAX(SUM(CASE WHEN pressure_avg > 0 THEN points ELSE 0 END), 1) AS pressure,
              COUNT(*) AS docs
       FROM ink_stats WHERE strokes > 0`
    )
    .get() as { strokes: number; points: number; mm: number; pressure: number; docs: number };

  const rows = db.prepare("SELECT tools FROM ink_stats WHERE strokes > 0").all() as {
    tools: string;
  }[];
  const toolCounts: Record<string, number> = {};
  for (const r of rows) {
    const t = JSON.parse(r.tools) as Record<string, number>;
    for (const [id, n] of Object.entries(t)) {
      const name = TOOL_NAMES[id] ?? "other";
      toolCounts[name] = (toolCounts[name] ?? 0) + n;
    }
  }
  const tools = Object.entries(toolCounts)
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n);

  const topDocs = db
    .prepare(
      `SELECT d.name, i.strokes, i.distance_mm FROM ink_stats i
       JOIN documents d ON d.id = i.doc_id AND d.deleted = 0
       WHERE i.strokes > 0 ORDER BY i.distance_mm DESC LIMIT 6`
    )
    .all() as { name: string; strokes: number; distance_mm: number }[];

  return { totals, tools, topDocs, scan: getInkScanProgress() };
}
