import nodemailer from "nodemailer";
import { getSettings, getSmtpCredentials } from "./settings";

// Emails "your daily briefing is ready". Credentials come from the settings
// page (stored locally in the database), with .env.local as a fallback.
// fallbackTo is used when no address is saved (the reMarkable account email).
export async function notifyBriefReady(fallbackTo: string, briefName: string): Promise<boolean> {
  const { email } = getSettings();
  if (!email.enabled) return false;
  const creds = getSmtpCredentials();
  const to = email.to || fallbackTo;
  if (!creds || !to) return false;
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user: creds.user, pass: creds.pass },
  });
  await transport.sendMail({
    from: `"inkwell" <${creds.user}>`,
    to,
    subject: "your daily briefing is ready",
    text: `"${briefName}" just landed in the Daily briefing folder on your reMarkable.\n\nsent with inkwell`,
  });
  return true;
}
