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
  // an ipv6 literal always contains colons; a domain never does. only apply
  // the ipv6 private-range prefixes to literals, else real sites that happen
  // to start with those letters (fdic.gov, fc2.com) get wrongly blocked.
  const isIpv6 = host.includes(":");
  if (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    isPrivateIpv4(host) ||
    (isIpv6 &&
      (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")))
  ) {
    throw new Error("that address is on your local network, not the web");
  }
  return url;
}

// fetch that re-checks every redirect hop, so a public URL can't bounce the
// server to a private address (metadata endpoints, LAN devices). Same
// signature as fetch, but the first argument must pass assertPublicUrl.
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  maxRedirects = 5
): Promise<Response> {
  let current = assertPublicUrl(rawUrl).href;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      current = assertPublicUrl(new URL(location, current).href).href;
      continue;
    }
    return res;
  }
  throw new Error("too many redirects");
}
