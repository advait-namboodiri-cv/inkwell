import { buildBrief, last7Dots } from "@/lib/brief";
import { renderBriefEmail } from "@/lib/briefEmail";

export const runtime = "nodejs";

// dev convenience: see today's notification email in the browser,
// with the cid logo swapped for the public png so it renders
export async function GET() {
  const brief = await buildBrief();
  const { html } = renderBriefEmail(brief, last7Dots());
  return new Response(html.replaceAll("cid:inkwell-logo", "/inkwell-logo.png"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
