import { createRequire } from "node:module";
import path from "node:path";
import PDFDocument from "pdfkit";
import { getDb } from "./db";
import { ensureSeeded, versionBundlePath } from "./versions";
import { renderPageSvg } from "./render";
import { deliverPdf } from "./deliver";

// day-first time machine: what did I touch on a given day, across every
// notebook, with previews and a restore-as-pdf escape hatch.

function dayRangeUtc(dateStr: string, tzOffsetMin: number): [number, number] {
  const base = Date.parse(`${dateStr}T00:00:00Z`);
  const shift = -tzOffsetMin * 60_000; // local = utc + shift
  return [base - shift, base - shift + 86_400_000];
}

export function activeDays(tzOffsetMin: number) {
  const shift = -tzOffsetMin * 60_000;
  return getDb()
    .prepare(
      `SELECT date((e.modifed + ?) / 1000, 'unixepoch') AS day,
              COUNT(DISTINCT e.doc_id) AS docs, COUNT(*) AS pages
       FROM page_events e
       JOIN documents d ON d.id = e.doc_id AND d.deleted = 0
       GROUP BY day ORDER BY day DESC LIMIT 180`
    )
    .all(shift) as { day: string; docs: number; pages: number }[];
}

export type DayDoc = {
  id: string;
  name: string;
  path: string;
  hash: string; // which snapshot previews should render from
  current: boolean; // true = no as-of snapshot exists, rendering today's ink
  pages: { id: string; index: number }[];
};

export async function dayDetail(dateStr: string, tzOffsetMin: number): Promise<DayDoc[]> {
  const [start, end] = dayRangeUtc(dateStr, tzOffsetMin);
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT e.doc_id, e.page_id, d.name, d.path
       FROM page_events e
       JOIN documents d ON d.id = e.doc_id AND d.deleted = 0
       WHERE e.modifed >= ? AND e.modifed < ?
       ORDER BY d.name, e.modifed`
    )
    .all(start, end) as { doc_id: string; page_id: string; name: string; path: string }[];

  const byDoc = new Map<string, DayDoc>();
  for (const r of rows) {
    if (!byDoc.has(r.doc_id)) {
      await ensureSeeded(r.doc_id);
      // as-of snapshot: latest one captured before the day ended
      const asOf = db
        .prepare(
          `SELECT hash FROM doc_versions WHERE doc_id = ? AND captured_at < ?
           ORDER BY captured_at DESC LIMIT 1`
        )
        .get(r.doc_id, end) as { hash: string } | undefined;
      const latest = db
        .prepare(
          `SELECT hash, pages FROM doc_versions WHERE doc_id = ?
           ORDER BY captured_at DESC LIMIT 1`
        )
        .get(r.doc_id) as { hash: string; pages: string } | undefined;
      if (!latest) continue;
      byDoc.set(r.doc_id, {
        id: r.doc_id,
        name: r.name,
        path: r.path,
        hash: asOf?.hash ?? latest.hash,
        current: !asOf,
        pages: [],
      });
    }
    const doc = byDoc.get(r.doc_id);
    if (!doc || doc.pages.length >= 24) continue;
    if (!doc.pages.some((p) => p.id === r.page_id)) {
      doc.pages.push({ id: r.page_id, index: 0 });
    }
  }

  // page numbers come from the order in the version's page list
  for (const doc of byDoc.values()) {
    const latest = db
      .prepare(
        `SELECT pages FROM doc_versions WHERE doc_id = ? AND hash = ?`
      )
      .get(doc.id, doc.hash) as { pages: string } | undefined;
    if (latest) {
      const order = (JSON.parse(latest.pages) as { id: string }[]).map((p) => p.id);
      for (const p of doc.pages) p.index = order.indexOf(p.id) + 1;
      doc.pages.sort((a, b) => a.index - b.index);
    }
  }
  return [...byDoc.values()];
}

// restore = rebuild the snapshot as a pdf and send it to the tablet,
// as a copy. native ink restore isn't possible over the sync api (it only
// accepts pdf and epub uploads), so this is the honest version of revert.
const MAX_RESTORE_PAGES = 120;
const PAGE: [number, number] = [450, 600];

type SvgToPdf = (
  doc: PDFKit.PDFDocument,
  svg: string,
  x: number,
  y: number,
  options?: Record<string, unknown>
) => void;
let svgToPdf: SvgToPdf | null = null;
function getSvgToPdf(): SvgToPdf {
  if (!svgToPdf) {
    const req = createRequire(path.join(process.cwd(), "package.json"));
    svgToPdf = req("svg-to-pdfkit") as SvgToPdf;
  }
  return svgToPdf;
}

export async function restoreAsPdf(
  docId: string,
  hash: string,
  dayLabel: string
): Promise<{ name: string; folder: string; pages: number }> {
  const db = getDb();
  const doc = db.prepare("SELECT name FROM documents WHERE id = ?").get(docId) as
    | { name: string }
    | undefined;
  const version = db
    .prepare("SELECT pages FROM doc_versions WHERE doc_id = ? AND hash = ?")
    .get(docId, hash) as { pages: string } | undefined;
  if (!doc || !version) throw new Error("snapshot not found");
  const pageIds = (JSON.parse(version.pages) as { id: string }[]).map((p) => p.id);
  if (pageIds.length > MAX_RESTORE_PAGES) {
    throw new Error(
      `this notebook has ${pageIds.length} pages, too big to rebuild as a pdf for now (limit ${MAX_RESTORE_PAGES})`
    );
  }
  const bundle = versionBundlePath(docId, hash);
  const svgs: string[] = [];
  for (const id of pageIds) {
    const svg = await renderPageSvg(bundle, id);
    if (svg) svgs.push(svg);
  }
  if (svgs.length === 0) throw new Error("no ink pages to rebuild in this snapshot");

  const pdf = await new Promise<Buffer>((resolve, reject) => {
    const pdoc = new PDFDocument({ size: PAGE, margin: 0, autoFirstPage: false });
    const chunks: Buffer[] = [];
    pdoc.on("data", (c: Buffer) => chunks.push(c));
    pdoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdoc.on("error", reject);
    for (const svg of svgs) {
      pdoc.addPage();
      try {
        getSvgToPdf()(pdoc, svg, 0, 0, {
          width: PAGE[0],
          height: PAGE[1],
          preserveAspectRatio: "xMidYMid meet",
        });
      } catch {
        /* skip unrenderable page */
      }
    }
    pdoc.end();
  });
  const name = `${doc.name} · as of ${dayLabel}`;
  const delivered = await deliverPdf(pdf, name.slice(0, 80), "inkwell restores");
  return { ...delivered, pages: svgs.length };
}
