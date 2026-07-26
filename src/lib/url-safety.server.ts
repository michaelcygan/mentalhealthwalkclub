/**
 * Server-only URL safety check for admin-provided URLs (RSS feeds, external audio).
 *
 * Rejects non-HTTPS URLs and URLs that resolve to private / loopback / link-local
 * networks to reduce SSRF risk. DNS lookup is best-effort; if it fails we still
 * enforce the HTTPS + literal-IP checks against the hostname itself.
 */
import { promises as dns } from "node:dns";

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 unique local
  if (lower.startsWith("fe80")) return true; // link-local
  return false;
}

export async function isSafePublicHttpsUrl(input: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host) return false;

  // Literal IP checks (skip DNS)
  const isIpv4 = /^[0-9.]+$/.test(host);
  const isIpv6 = host.includes(":");
  if (isIpv4) return !isPrivateIPv4(host);
  if (isIpv6) return !isPrivateIPv6(host);

  // Blocklist obvious local names
  const lower = host.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".local") || lower.endsWith(".internal")) return false;

  // Best-effort DNS
  try {
    const records = await dns.lookup(host, { all: true });
    for (const r of records) {
      if (r.family === 4 && isPrivateIPv4(r.address)) return false;
      if (r.family === 6 && isPrivateIPv6(r.address)) return false;
    }
  } catch {
    // DNS unavailable — allow, since HTTPS + non-local host is already required.
  }
  return true;
}
