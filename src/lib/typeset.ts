import PDFDocument from "pdfkit";
import type { Article } from "./article";

// Typesets an article as a calm, e-ink-first PDF.
// Page is 450×600pt — the reMarkable's exact 3:4 aspect — so it fills the
// screen edge to edge. Serif body for long reading, generous margins.
const PAGE: [number, number] = [450, 600];
const MARGIN = 46;

export function articlePdf(article: Article): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: PAGE,
      margins: { top: MARGIN, bottom: MARGIN + 14, left: MARGIN, right: MARGIN },
      info: { Title: article.title, Author: article.byline || article.site },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // header
    doc.font("Times-Bold").fontSize(21).text(article.title, { lineGap: 3 });
    doc.moveDown(0.3);
    const meta = [article.byline, article.site].filter(Boolean).join(" · ");
    if (meta) doc.font("Helvetica").fontSize(9).fillColor("#666").text(meta);
    doc.moveDown(0.2);
    doc
      .moveTo(MARGIN, doc.y + 6)
      .lineTo(PAGE[0] - MARGIN, doc.y + 6)
      .lineWidth(0.7)
      .strokeColor("#999")
      .stroke();
    doc.moveDown(1.2);
    doc.fillColor("#111");

    // body
    for (const b of article.blocks) {
      switch (b.kind) {
        case "h":
          doc.moveDown(0.6);
          doc.font("Times-Bold").fontSize(14).text(b.text, { lineGap: 2 });
          doc.moveDown(0.2);
          break;
        case "quote":
          doc.moveDown(0.2);
          doc
            .font("Times-Italic")
            .fontSize(11.5)
            .text(b.text, { indent: 14, lineGap: 2.5 });
          doc.moveDown(0.2);
          break;
        case "li":
          doc.font("Times-Roman").fontSize(11.5).text(`•  ${b.text}`, {
            indent: 8,
            lineGap: 2.5,
          });
          break;
        default:
          doc.font("Times-Roman").fontSize(11.5).text(b.text, {
            lineGap: 2.5,
            paragraphGap: 6,
          });
      }
    }

    // sign-off
    doc.moveDown(1.5);
    doc.font("Helvetica").fontSize(8.5).fillColor("#888").text("sent with inkwell ✦");

    doc.end();
  });
}
