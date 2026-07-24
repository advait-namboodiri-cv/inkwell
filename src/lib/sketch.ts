import { createRequire } from "node:module";
import path from "node:path";
import PDFDocument from "pdfkit";
import { chat, type AiResult } from "./ai";
import { deliverPdf } from "./deliver";

// prompt → SVG line art → (preview in browser) → PDF → tablet.
// Pure black vector strokes render beautifully on e-ink.
const SYSTEM = `You draw black and white vector line art for an e-ink paper tablet. Given a request, respond with ONE complete SVG document and nothing else, no markdown fences, no commentary.

Rules: viewBox="0 0 900 1200" portrait. Only stroke-based drawing: black strokes (#111) on no background, stroke-width between 2 and 6, fill="none" except small deliberate solid accents. Build the drawing from paths, circles, ellipses, rects and lines. Aim for clean, confident, minimal line art with good composition and plenty of whitespace. Fewer, bolder shapes beat many small ones: at most 40 elements, and the whole SVG under 4000 characters. No <script>, no <image>, no external references, no gradients, no text unless the request asks for labels.`;

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

function sanitizeSvg(raw: string): string {
  const noFences = raw.replace(/```(?:svg|xml|html)?/gi, "");
  let svg: string;
  const match = noFences.match(/<svg[\s\S]*<\/svg>/i);
  if (match) {
    svg = match[0];
  } else {
    // model ran out of tokens mid-drawing: salvage what's there and close it
    const start = noFences.search(/<svg/i);
    if (start === -1) throw new Error("the model didn't return an svg, try again or rephrase");
    let frag = noFences.slice(start);
    frag = frag.slice(0, frag.lastIndexOf(">") + 1);
    svg = `${frag}</svg>`;
  }
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\shref="(?!#)[^"]*"/gi, "")
    .replace(/\sxlink:href="(?!#)[^"]*"/gi, "");
}

export async function makeSketch(prompt: string): Promise<{ svg: string; ai: AiResult }> {
  const ai = await chat("sketch", SYSTEM, prompt, 4096);
  return { svg: sanitizeSvg(ai.text), ai };
}

export async function sendSketch(
  svg: string,
  title: string
): Promise<{ name: string; folder: string }> {
  const clean = sanitizeSvg(svg);
  const pdf = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: PAGE, margin: 0, info: { Title: title } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      getSvgToPdf()(doc, clean, 0, 0, {
        width: PAGE[0],
        height: PAGE[1],
        preserveAspectRatio: "xMidYMid meet",
      });
    } catch {
      reject(new Error("this svg couldn't be rendered to pdf"));
      return;
    }
    doc.end();
  });
  return deliverPdf(pdf, title, "inkwell inbox");
}
