import { getSyncState, setSyncState } from "./db";

// removal_mode:
//   "trash"  — archive to vault, then move the doc to the tablet's trash (default)
//   "delete" — archive to vault, then permanently delete from the cloud
export type RemovalMode = "trash" | "delete";

export type Settings = { removalMode: RemovalMode };

export function getSettings(): Settings {
  const mode = getSyncState("removal_mode");
  return { removalMode: mode === "delete" ? "delete" : "trash" };
}

export function updateSettings(patch: Partial<Settings>): Settings {
  if (patch.removalMode === "trash" || patch.removalMode === "delete") {
    setSyncState("removal_mode", patch.removalMode);
  }
  return getSettings();
}
