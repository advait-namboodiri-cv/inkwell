import PDFDocument from "pdfkit";
import { chat, type AiResult } from "./ai";
import { deliverPdf } from "./deliver";

// prompt → problems → handwriting-friendly PDF → tablet
const SYSTEM = `You write practice worksheets for someone who will solve them by hand on a paper tablet. Given a topic request, respond in EXACTLY this plain text format:

TITLE: a short worksheet title
1. first problem
2. second problem
...continue numbering...
ANSWERS:
1. answer to problem one
2. answer to problem two
...

Rules: default to 8 problems unless the request asks for a different count. Problems must be concrete and solvable, ordered easy to hard. Keep each problem on a single line where possible. Use plain text math like x^2 and 3/4, never LaTeX. Never use em dashes or en dashes. No commentary before TITLE or after the last answer.`;

const PAGE: [number, number] = [450, 600];
const M = 46;

type Parsed = { title: string; problems: string[]; answers: string[] };

function parseWorksheet(text: string, fallbackTitle: string): Parsed {
  const lines = text.split("\n").map((l) => l.trim());
  let title = fallbackTitle;
  const problems: string[] = [];
  const answers: string[] = [];
  let inAnswers = false;
  for (const line of lines) {
    if (!line) continue;
    if (/^TITLE\s*:/i.test(line)) {
      title = line.replace(/^TITLE\s*:\s*/i, "").trim() || fallbackTitle;
      continue;
    }
    if (/^ANSWERS?\s*:?$/i.test(line)) {
      inAnswers = true;
      continue;
    }
    const m = line.match(/^\d+[.)]\s*(.+)$/);
    if (m) (inAnswers ? answers : problems).push(m[1].trim());
  }
  if (problems.length === 0) throw new Error("the model didn't produce problems, try rephrasing");
  return { title, problems, answers };
}

function worksheetPdf(p: Parsed, includeAnswers: boolean, modelLabel: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: PAGE,
      margins: { top: M, bottom: M, left: M, right: M },
      info: { Title: p.title },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica").fontSize(8.5).fillColor("#777").text("INKWELL WORKSHEET", { characterSpacing: 1.5 });
    doc.moveDown(0.2);
    doc.font("Times-Bold").fontSize(19).fillColor("#111").text(p.title, { lineGap: 3 });
    doc.moveDown(0.3);
    doc
      .moveTo(M, doc.y)
      .lineTo(PAGE[0] - M, doc.y)
      .lineWidth(0.7)
      .strokeColor("#999")
      .stroke();
    doc.moveDown(1);

    p.problems.forEach((prob, i) => {
      doc.font("Times-Roman").fontSize(12).fillColor("#111").text(`${i + 1}.  ${prob}`, { lineGap: 3 });
      // generous blank space to work by hand
      doc.moveDown(3.5);
    });

    if (includeAnswers && p.answers.length > 0) {
      doc.addPage();
      doc.font("Helvetica").fontSize(8.5).fillColor("#777").text("ANSWERS", { characterSpacing: 1.5 });
      doc.moveDown(0.6);
      p.answers.forEach((a, i) => {
        doc.font("Times-Roman").fontSize(11).fillColor("#111").text(`${i + 1}.  ${a}`, { lineGap: 2.5 });
        doc.moveDown(0.5);
      });
    }

    doc.moveDown(1);
    doc.font("Helvetica").fontSize(7.5).fillColor("#999").text(`sent with inkwell · ${modelLabel}`);
    doc.end();
  });
}

export async function makeWorksheet(
  prompt: string,
  includeAnswers: boolean
): Promise<{ name: string; folder: string; ai: AiResult; problems: number }> {
  const ai = await chat("worksheet", SYSTEM, prompt, 2048);
  const parsed = parseWorksheet(ai.text, prompt.slice(0, 60));
  const pdf = await worksheetPdf(
    parsed,
    includeAnswers,
    ai.provider === "local" ? "local model" : ai.model
  );
  const delivered = await deliverPdf(pdf, parsed.title, "inkwell inbox");
  return { ...delivered, ai, problems: parsed.problems.length };
}
