import PDFDocument from "pdfkit";
import type { Brief } from "./brief";

// One calm page for the morning: date, weather, todos with real checkboxes
// (sized for handwriting a tick with the marker), three stories, a passage,
// and a quote at the foot. reMarkable 3:4 page, e-ink contrast only.
const PAGE: [number, number] = [450, 600];
const M = 42;

export function briefPdf(brief: Brief): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: PAGE,
      margins: { top: M, bottom: M, left: M, right: M },
      info: { Title: `daily brief — ${brief.dateLabel}` },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const width = PAGE[0] - M * 2;

    // header
    doc.font("Helvetica").fontSize(8.5).fillColor("#777").text("INKWELL DAILY BRIEF", { characterSpacing: 1.5 });
    doc.moveDown(0.2);
    doc.font("Times-Bold").fontSize(20).fillColor("#111").text(brief.dateLabel.toLowerCase());
    if (brief.weather) {
      doc.moveDown(0.15);
      doc.font("Helvetica").fontSize(9).fillColor("#555").text(brief.weather.label);
    }
    rule(doc);

    // todos
    if (brief.todos.length > 0) {
      section(doc, "today");
      for (const t of brief.todos) {
        const y = doc.y;
        doc.lineWidth(0.9).strokeColor("#333").rect(M, y + 1, 9, 9).stroke();
        doc
          .font("Times-Roman")
          .fontSize(11.5)
          .fillColor("#111")
          .text(t, M + 17, y, { width: width - 17, lineGap: 2 });
        doc.moveDown(0.45);
      }
      doc.x = M;
      rule(doc);
    }

    // news
    if (brief.news.length > 0) {
      section(doc, "while you slept");
      for (const n of brief.news) {
        doc.font("Times-Bold").fontSize(11.5).fillColor("#111").text(n.title, { lineGap: 2 });
        if (n.summary) {
          doc.font("Times-Roman").fontSize(10).fillColor("#333").text(n.summary, { lineGap: 2 });
        }
        doc.font("Helvetica").fontSize(7.5).fillColor("#888").text(n.source.toUpperCase(), { characterSpacing: 1 });
        doc.moveDown(0.55);
      }
      rule(doc);
    }

    // passage
    if (brief.passage) {
      section(doc, "from your margins");
      doc
        .font("Times-Italic")
        .fontSize(11)
        .fillColor("#111")
        .text(`“${brief.passage.text}”`, { lineGap: 2.5 });
      doc.font("Helvetica").fontSize(8).fillColor("#777").text(`— ${brief.passage.doc}`);
      rule(doc);
    }

    // quote foot
    doc.moveDown(0.4);
    doc
      .font("Times-Italic")
      .fontSize(10)
      .fillColor("#444")
      .text(`“${brief.quote.text}”`, { lineGap: 2 });
    doc.font("Helvetica").fontSize(8).fillColor("#888").text(`— ${brief.quote.by}`);
    doc.moveDown(0.8);
    doc.font("Helvetica").fontSize(7.5).fillColor("#999").text("sent with inkwell ✦");

    doc.end();
  });
}

function rule(doc: PDFKit.PDFDocument) {
  doc.moveDown(0.5);
  doc
    .moveTo(M, doc.y)
    .lineTo(PAGE[0] - M, doc.y)
    .lineWidth(0.6)
    .strokeColor("#bbb")
    .stroke();
  doc.moveDown(0.6);
}

function section(doc: PDFKit.PDFDocument, label: string) {
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#666").text(label.toUpperCase(), { characterSpacing: 1.2 });
  doc.moveDown(0.35);
}
