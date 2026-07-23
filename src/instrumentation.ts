// Runs once when the server boots: a gentle scheduler that sends the
// daily brief at the configured hour (default 7am) while inkwell is running.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getSettings } = await import("./lib/settings");
  const { briefSentToday, sendBrief } = await import("./lib/brief");
  const { isPaired } = await import("./lib/rmapi");

  setInterval(async () => {
    try {
      if (!isPaired() || briefSentToday()) return;
      const { brief } = getSettings();
      const now = new Date();
      if (now.getHours() === brief.hour) {
        await sendBrief();
        console.log(`[inkwell] daily brief sent at ${now.toLocaleTimeString()}`);
      }
    } catch (err) {
      console.error("[inkwell] daily brief failed:", err);
    }
  }, 60_000);
}
