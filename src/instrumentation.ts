// Runs once when the server boots: a gentle scheduler that sends the
// daily brief at the configured time (default 07:00) while inkwell is running.
// Uses ">= scheduled time today" so a sleeping laptop still gets its brief
// on wake instead of silently skipping the day.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getSettings } = await import("./lib/settings");
  const { briefSentToday, sendBrief } = await import("./lib/brief");
  const { isPaired } = await import("./lib/rmapi");
  const { ensureMlx } = await import("./lib/mlx");

  // bring the local model up with the app, and keep it up
  void ensureMlx();
  setInterval(() => void ensureMlx(), 60_000);

  setInterval(async () => {
    try {
      if (!isPaired() || briefSentToday()) return;
      const { brief } = getSettings();
      const [h, m] = brief.time.split(":").map(Number);
      const now = new Date();
      const dueAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
      if (now >= dueAt) {
        await sendBrief();
        console.log(`[inkwell] daily brief sent at ${now.toLocaleTimeString()}`);
      }
    } catch (err) {
      console.error("[inkwell] daily brief failed:", err);
    }
  }, 60_000);
}
