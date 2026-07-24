import fs from "node:fs";
import path from "node:path";
import type { Brief } from "./brief";

// Renders the daily brief notification email from the designed template.
// Sections with no data are stripped whole, so the email degrades gracefully.
const TEMPLATE_PATH = path.join(process.cwd(), "src", "emails", "daily-brief.html");
const LEXEND_STACK =
  "'Lexend', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stripSection(html: string, name: string, keep: boolean): string {
  const re = new RegExp(`<!--SEC:${name}-->([\\s\\S]*?)<!--/SEC:${name}-->`, "g");
  return html.replace(re, keep ? "$1" : "");
}

function todoRow(text: string, last: boolean): string {
  return `<tr>
<td style="padding:0 0 ${last ? 18 : 5}px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="12" height="12" style="width:12px; height:12px; border:1px solid #b5afa1; border-radius:3px; font-size:1px; line-height:1px;">&nbsp;</td>
<td style="padding-left:10px; font-family:${LEXEND_STACK}; font-size:14px; line-height:20px; mso-line-height-rule:exactly; color:#211d16;">${escapeHtml(text)}</td>
</tr>
</table>
</td>
</tr>`;
}

function moreTodosRow(count: number): string {
  return `<tr>
<td style="padding:0 0 18px 0; font-family:${LEXEND_STACK}; font-size:12px; line-height:18px; mso-line-height-rule:exactly; color:#6f6a5e;">+ ${count} more in your brief</td>
</tr>`;
}

const SHOWN_TODOS = 2;

export function renderBriefEmail(
  brief: Brief,
  dots: string[]
): { subject: string; html: string; text: string } {
  let html = fs.readFileSync(TEMPLATE_PATH, "utf8");

  // sections
  html = stripSection(html, "WEATHER", brief.weather !== null);
  html = stripSection(html, "TODOS", brief.todos.length > 0);
  html = stripSection(html, "NEWS", brief.news.length > 0);
  html = stripSection(html, "MORENEWS", brief.news.length > 1);
  html = stripSection(html, "INK", true);
  html = stripSection(html, "QUOTE", Boolean(brief.quote));

  // todos: first few, then a "+ n more" line
  const shown = brief.todos.slice(0, SHOWN_TODOS);
  const rows =
    shown.map((t, i) => todoRow(t, i === shown.length - 1 && brief.todos.length <= SHOWN_TODOS)).join("\n") +
    (brief.todos.length > SHOWN_TODOS ? `\n${moreTodosRow(brief.todos.length - SHOWN_TODOS)}` : "");

  const weatherShort = brief.weather
    ? brief.weather.label.split(" · ").slice(1).join(" · ") || brief.weather.label
    : "your morning at a glance";
  const preheader = [
    weatherShort,
    brief.todos.length > 0 ? `${brief.todos.length} open todos` : "",
    "waiting in your daily briefing folder",
  ]
    .filter(Boolean)
    .join(" · ");

  const tokens: Record<string, string> = {
    preheader: escapeHtml(preheader),
    date: escapeHtml(brief.dateLabel.toLowerCase()),
    weatherLabel: escapeHtml(brief.weather?.label ?? ""),
    weatherDetail: escapeHtml(brief.weather?.detail ?? ""),
    todoCount: String(brief.todos.length),
    todoRows: rows,
    headlineSource1: escapeHtml((brief.news[0]?.source ?? "").toUpperCase()),
    headline1: escapeHtml(brief.news[0]?.title ?? ""),
    moreHeadlineCount: String(Math.max(0, brief.news.length - 1)),
    inkStats: escapeHtml(brief.inkStats?.label ?? "your last 7 days of ink"),
    quoteText: escapeHtml(brief.quote.text),
    quoteAuthor: escapeHtml(brief.quote.by),
  };
  dots.forEach((color, i) => (tokens[`dot${i + 1}`] = color));

  for (const [key, value] of Object.entries(tokens)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }

  const text = [
    `${brief.dateLabel.toLowerCase()}`,
    `your daily briefing is ready`,
    "",
    brief.weather ? `${brief.weather.label}\n${brief.weather.detail}` : "",
    brief.todos.length > 0
      ? `${brief.todos.length} open todos:\n${brief.todos
          .slice(0, SHOWN_TODOS)
          .map((t) => `  [ ] ${t}`)
          .join("\n")}${brief.todos.length > SHOWN_TODOS ? `\n  + ${brief.todos.length - SHOWN_TODOS} more` : ""}`
      : "",
    brief.news[0] ? `${brief.news[0].source}: ${brief.news[0].title}` : "",
    brief.inkStats?.label ?? "",
    "",
    `"${brief.quote.text}" ${brief.quote.by}`,
    "",
    "waiting in your daily briefing folder, ready with your coffee",
    "sent with inkwell",
  ]
    .filter((l) => l !== "")
    .join("\n");

  return {
    subject: `your daily briefing is ready · ${brief.dateLabel.toLowerCase()}`,
    html,
    text,
  };
}
