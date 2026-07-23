import nodemailer from "nodemailer";

// Emails "your daily briefing is ready" to the reMarkable account address.
// Needs SMTP_USER + SMTP_PASS (a Gmail app password) in .env.local —
// if they're not set, this quietly does nothing.
export async function notifyBriefReady(to: string, briefName: string): Promise<boolean> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass || !to) return false;
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  await transport.sendMail({
    from: `"inkwell" <${user}>`,
    to,
    subject: "your daily briefing is ready",
    text: `"${briefName}" just landed in the Daily briefing folder on your reMarkable.\n\nsent with inkwell`,
  });
  return true;
}
