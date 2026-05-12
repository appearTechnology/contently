import dns from "node:dns/promises";
import net from "node:net";

export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const MAX_CSS_BYTES = 512 * 1024;
export const MAX_LOGO_BYTES = 512 * 1024;
const MAX_REDIRECTS = 8;
const FETCH_TIMEOUT_MS = 25_000;

/** Browser-like UA — many sites block non-browser / generic bot strings (fewer false FETCH_FAILED). */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const FETCH_HEADERS_BASE = {
  "User-Agent": USER_AGENT,
  "Accept-Language": "en-US,en;q=0.9",
} as const;

function rootCause(err: unknown): unknown {
  let cur: unknown = err;
  for (let i = 0; i < 6; i++) {
    if (cur instanceof Error && cur.cause !== undefined) cur = cur.cause;
    else break;
  }
  return cur;
}

/** Turns low-level Node / undici errors into messages suitable for API JSON + toasts. */
export function humanizeFetchError(err: unknown): string {
  const e = rootCause(err) as NodeJS.ErrnoException & Error;
  const code = typeof e?.code === "string" ? e.code : "";
  const msg = e instanceof Error ? e.message : String(err);

  switch (code) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return "Could not resolve that domain. Check the spelling or try again.";
    case "ECONNREFUSED":
      return "Connection refused — the server may be down or blocking automated requests.";
    case "ETIMEDOUT":
    case "ESOCKETTIMEDOUT":
      return "Connection timed out — try again or use a different URL.";
    case "ENETUNREACH":
    case "EHOSTUNREACH":
      return "Network unreachable — check the URL or try from another network.";
    case "CERT_HAS_EXPIRED":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
    case "ERR_TLS_CERT_ALTNAME_INVALID":
      return "Could not verify the site’s SSL certificate — try opening the URL in a browser first.";
    default:
      break;
  }

  const lower = msg.toLowerCase();
  if (
    lower.includes("certificate") ||
    lower.includes("ssl") ||
    lower.includes("tls") ||
    lower.includes("x509")
  ) {
    return "Could not establish a secure connection to this site.";
  }
  if (lower.includes("getaddrinfo") || lower.includes("name resolution")) {
    return "Could not resolve that domain. Check the spelling or try again.";
  }

  return msg.length > 200 ? `${msg.slice(0, 197)}…` : msg;
}

export class SafeFetchError extends Error {
  constructor(
    readonly code:
      | "INVALID_URL"
      | "FORBIDDEN_HOST"
      | "TOO_MANY_REDIRECTS"
      | "FETCH_FAILED"
      | "FETCH_TIMEOUT"
      | "TOO_LARGE"
      | "BAD_STATUS",
    message: string,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

function isPrivateIPv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254 && parts[2] === 169 && parts[3] === 254)
    return true;
  return false;
}

function isPrivateOrBlockedIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map((x) => Number(x));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    return isPrivateIPv4(parts);
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("fe80:")) return true;
    return false;
  }
  return true;
}

async function assertHostnameSafe(hostname: string): Promise<void> {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) {
    throw new SafeFetchError("FORBIDDEN_HOST", "Local hosts are not allowed.");
  }

  const literal = net.isIP(hostname);
  if (literal === 4 || literal === 6) {
    if (isPrivateOrBlockedIP(hostname)) {
      throw new SafeFetchError(
        "FORBIDDEN_HOST",
        "Private or loopback addresses are not allowed.",
      );
    }
    return;
  }

  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch (e) {
    throw new SafeFetchError("FETCH_FAILED", humanizeFetchError(e));
  }

  if (records.length === 0) {
    throw new SafeFetchError("FETCH_FAILED", "Hostname resolved to no addresses.");
  }

  for (const r of records) {
    if (isPrivateOrBlockedIP(r.address)) {
      throw new SafeFetchError(
        "FORBIDDEN_HOST",
        "Hostname resolves to a disallowed address.",
      );
    }
  }
}

export function normalizeImportUrl(input: string): URL {
  let candidate = input.trim();
  if (!candidate) {
    throw new SafeFetchError("INVALID_URL", "URL is empty.");
  }
  /** Protocol-relative URLs from pasted links */
  if (candidate.startsWith("//")) {
    candidate = `https:${candidate}`;
  }
  const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(candidate);
  const withScheme = hasScheme ? candidate : `https://${candidate}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new SafeFetchError("INVALID_URL", "Could not parse URL.");
  }
  if (url.username || url.password) {
    throw new SafeFetchError("INVALID_URL", "URLs with credentials are not allowed.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("INVALID_URL", "Only http and https URLs are allowed.");
  }
  return url;
}

export async function validateUrlForFetch(url: URL): Promise<void> {
  await assertHostnameSafe(url.hostname);
}

async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
): Promise<ArrayBuffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buf = await response.arrayBuffer();
    if (buf.byteLength > maxBytes) {
      throw new SafeFetchError("TOO_LARGE", "Response exceeded size limit.");
    }
    return buf;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        reader.releaseLock();
        throw new SafeFetchError("TOO_LARGE", "Response exceeded size limit.");
      }
      chunks.push(value);
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

export type SafeFetchedResource = {
  finalUrl: string;
  buffer: Buffer;
  contentType: string | undefined;
};

export async function safeFetchWithRedirects(
  startUrl: URL,
  maxBytes: number,
  acceptHeader: string,
): Promise<SafeFetchedResource> {
  let current = new URL(startUrl.href);
  await validateUrlForFetch(current);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(current.href, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          ...FETCH_HEADERS_BASE,
          Accept: acceptHeader,
          "Accept-Encoding": "identity",
        },
      });
    } catch (e) {
      clearTimeout(timer);
      const aborted =
        e instanceof Error &&
        (e.name === "AbortError" || /abort/i.test(e.message));
      if (aborted) {
        throw new SafeFetchError(
          "FETCH_TIMEOUT",
          `The page took longer than ${FETCH_TIMEOUT_MS / 1000} seconds to respond. Try again or use a different URL.`,
        );
      }
      throw new SafeFetchError("FETCH_FAILED", humanizeFetchError(e));
    }
    clearTimeout(timer);

    const status = response.status;
    if (status >= 300 && status < 400) {
      const loc = response.headers.get("location");
      if (!loc || hop === MAX_REDIRECTS) {
        throw new SafeFetchError(
          hop === MAX_REDIRECTS ? "TOO_MANY_REDIRECTS" : "FETCH_FAILED",
          hop === MAX_REDIRECTS
            ? "Too many redirects."
            : "Redirect without Location header.",
        );
      }
      let next: URL;
      try {
        next = new URL(loc, current.href);
      } catch {
        throw new SafeFetchError("FETCH_FAILED", "Invalid redirect URL.");
      }
      if (next.protocol !== "http:" && next.protocol !== "https:") {
        throw new SafeFetchError("FORBIDDEN_HOST", "Redirect to non-http(s) URL.");
      }
      await validateUrlForFetch(next);
      current = next;
      continue;
    }

    if (!response.ok) {
      throw new SafeFetchError(
        "BAD_STATUS",
        `HTTP ${status}: ${response.statusText || "error"}`,
      );
    }

    let buf: ArrayBuffer;
    try {
      buf = await readBodyWithLimit(response, maxBytes);
    } catch (e) {
      if (e instanceof SafeFetchError) throw e;
      throw new SafeFetchError("FETCH_FAILED", humanizeFetchError(e));
    }
    const contentType = response.headers.get("content-type") ?? undefined;
    return {
      finalUrl: current.href,
      buffer: Buffer.from(buf),
      contentType,
    };
  }

  throw new SafeFetchError("TOO_MANY_REDIRECTS", "Too many redirects.");
}

export async function safeFetchHtml(startUrl: URL): Promise<SafeFetchedResource> {
  return safeFetchWithRedirects(
    startUrl,
    MAX_HTML_BYTES,
    "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  );
}

export async function safeFetchStylesheet(
  pageUrl: URL,
  href: string,
): Promise<SafeFetchedResource | null> {
  let cssUrl: URL;
  try {
    cssUrl = new URL(href, pageUrl.href);
  } catch {
    return null;
  }
  if (cssUrl.protocol !== "http:" && cssUrl.protocol !== "https:") return null;
  try {
    await validateUrlForFetch(cssUrl);
    return await safeFetchWithRedirects(
      cssUrl,
      MAX_CSS_BYTES,
      "text/css,*/*;q=0.1",
    );
  } catch {
    return null;
  }
}

export async function safeFetchImage(
  pageUrl: URL,
  href: string,
): Promise<SafeFetchedResource | null> {
  let imgUrl: URL;
  try {
    imgUrl = new URL(href, pageUrl.href);
  } catch {
    return null;
  }
  if (imgUrl.protocol !== "http:" && imgUrl.protocol !== "https:") return null;
  try {
    await validateUrlForFetch(imgUrl);
    return await safeFetchWithRedirects(
      imgUrl,
      MAX_LOGO_BYTES,
      "image/*,*/*;q=0.8",
    );
  } catch {
    return null;
  }
}
