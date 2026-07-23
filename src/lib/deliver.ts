import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runRmapi } from "./rmapi";

// Puts a generated PDF onto the tablet, inside a named inkwell folder.
export const INBOX_FOLDER = "inkwell inbox";

function sanitizeName(name: string): string {
  return (
    name
      .replace(/[/\\:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 90) || "untitled"
  );
}

export async function deliverPdf(
  pdf: Buffer,
  title: string,
  folder: string = INBOX_FOLDER
): Promise<{ name: string; folder: string }> {
  // ensure the folder exists (harmless if it already does)
  await runRmapi(["mkdir", `/${folder}`], undefined, 30_000);

  const name = sanitizeName(title);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "inkwell-deliver-"));
  const file = path.join(tmp, `${name}.pdf`);
  try {
    fs.writeFileSync(file, pdf);
    const res = await runRmapi(["put", file, `/${folder}`], undefined, 120_000);
    if (res.code !== 0) {
      // already exists → retry once with a numbered name
      if (/entry already exists/i.test(res.stderr + res.stdout)) {
        const alt = path.join(tmp, `${name} ${Date.now() % 1000}.pdf`);
        fs.renameSync(file, alt);
        const retry = await runRmapi(["put", alt, `/${folder}`], undefined, 120_000);
        if (retry.code !== 0) throw new Error(`upload failed: ${retry.stderr.slice(0, 150)}`);
        return { name: path.basename(alt, ".pdf"), folder };
      }
      throw new Error(`upload failed: ${res.stderr.slice(0, 150)}`);
    }
    return { name, folder };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
