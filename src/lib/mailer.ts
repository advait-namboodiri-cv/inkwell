import nodemailer from "nodemailer";
import { getSettings, getSmtpCredentials } from "./settings";

// actually logs into gmail with the saved credentials, so the settings
// page can show a real "connected" tick instead of hoping for the best
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  const creds = getSmtpCredentials();
  if (!creds) return { ok: false, error: "enter a gmail address and app password first" };
  try {
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: creds.user, pass: creds.pass },
    });
    await transport.verify();
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const friendly = /535|BadCredentials|Invalid login/i.test(msg)
      ? "gmail rejected the login. check the address and app password (and that 2 step verification is on)"
      : `couldn't reach gmail: ${msg.slice(0, 120)}`;
    return { ok: false, error: friendly };
  }
}

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
