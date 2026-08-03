// shared input guards for anything that reaches the filesystem or the network

// reMarkable ids are uuids; hashes are hex. reject anything else so a crafted
// id can never walk out of the bundles/versions folders.
const ID_RE = /^[0-9a-f-]{8,64}$/i;

export function isSafeId(value: unknown): value is string {
  return typeof value === "string" && ID_RE.test(value);
}

export function assertSafeId(value: unknown, label = "id"): string {
  if (!isSafeId(value)) throw new Error(`invalid ${label}`);
  return value;
}

// Block fetches aimed at the machine itself or the local network. inkwell
// runs on a laptop that can see routers, printers and other services; a
// pasted link (or one sent by the browser extension) should never be able to
// make the server request those.
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

export function assertPublicUrl(raw: string): URL {
  const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("only http and https links are supported");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    isPrivateIpv4(host) ||
    host.startsWith("fe80:") ||
    host.startsWith("fc") ||
    host.startsWith("fd")
  ) {
    throw new Error("that address is on your local network, not the web");
  }
  return url;
}
