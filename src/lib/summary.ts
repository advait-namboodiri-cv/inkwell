import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pdfParse from "pdf-parse";
import { getDb } from "./db";
import { chat, type AiResult } from "./ai";

const pExecFile = promisify(execFile);
const BUNDLE_DIR = path.join(process.cwd(), "data", "bundles");

// keep the prompt within a local 14B model's comfortable context
const MAX_CHARS = 24_000;

const SYSTEM = `You summarize documents for the owner of a reMarkable paper tablet. Write a grounded, specific summary of the document text you are given: what it is, the main ideas or arguments, and anything notably useful or actionable. Use plain language in second person where natural. Two or three short paragraphs, no headings, no bullet lists, no preamble like "This document". Never use em dashes or en dashes anywhere, use commas or periods instead. If the text is fragmentary lecture slides or notes, say what the material covers and the key concepts rather than apologizing about formatting.`;

export type SummaryRow = {
  doc_id: string;
  hash: string;
  summary: string;
  provider: string;
  model: string;
  created_at: number;
};

export function cachedSummary(docId: string): SummaryRow | null {
  return (
    (getDb()
      .prepare("SELECT * FROM summaries WHERE doc_id = ?")
      .get(docId) as SummaryRow | undefined) ?? null
  );
}

async function extractText(docId: string): Promise<string> {
  const bundle = path.join(BUNDLE_DIR, `${docId}.rmdoc`);
  if (!fs.existsSync(bundle)) {
    throw new Error("this doc's bundle isn't downloaded yet. sync and try again");
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "inkwell-sum-"));
  try {
    const pdfPath = path.join(tmp, "doc.pdf");
    // every bundle carries a rendered pdf of the doc
    const { stdout } = await pExecFile("unzip", ["-p", bundle, "*.pdf"], {
      encoding: "buffer",
      maxBuffer: 256 * 1024 * 1024,
    });
    fs.writeFileSync(pdfPath, stdout as Buffer);
    const parsed = await pdfParse(fs.readFileSync(pdfPath));
    const text = (parsed.text ?? "").replace(/\s+/g, " ").trim();
    if (text.length < 200) {
      throw new Error(
        "this document has almost no extractable text (probably pure handwriting). summaries need typed or book text for now"
      );
    }
    return text.length > MAX_CHARS
      ? `${text.slice(0, MAX_CHARS)}\n\n[document truncated for length]`
      : text;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export async function summarize(
  docId: string
): Promise<{ row: SummaryRow; ai: AiResult | null; cached: boolean }> {
  const db = getDb();
  const doc = db
    .prepare("SELECT id, name, hash, page_count FROM documents WHERE id = ? AND deleted = 0")
    .get(docId) as { id: string; name: string; hash: string; page_count: number } | undefined;
  if (!doc) throw new Error("document not found");

  // cache-first: frozen once generated, regenerated only if the doc changed
  const existing = cachedSummary(docId);
  if (existing && existing.hash === doc.hash) {
    return { row: existing, ai: null, cached: true };
  }

  const text = await extractText(docId);
  const ai = await chat(
    "summary",
    SYSTEM,
    `Document title: ${doc.name} (${doc.page_count} pages)\n\nDocument text:\n${text}`,
    1024
  );
  const row: SummaryRow = {
    doc_id: docId,
    hash: doc.hash,
    summary: ai.text.trim(),
    provider: ai.provider,
    model: ai.model,
    created_at: Date.now(),
  };
  db.prepare(
    `INSERT INTO summaries (doc_id, hash, summary, provider, model, created_at)
     VALUES (@doc_id, @hash, @summary, @provider, @model, @created_at)
     ON CONFLICT(doc_id) DO UPDATE SET hash = excluded.hash, summary = excluded.summary,
       provider = excluded.provider, model = excluded.model, created_at = excluded.created_at`
  ).run(row);
  return { row, ai, cached: false };
}
