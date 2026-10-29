// Fetches a page or file someone pasted a link to, with a time limit and a size limit,
// and refuses links to this machine or private networks.

export class FetchProblem extends Error {}

function isPrivateHost(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^(0|10|127)\./.test(h) || /^169\.254\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h.includes(":")) return h === "::1" || /^(fc|fd|fe80|::ffff:)/.test(h);
  return !h.includes(".");
}

export function cleanUrl(raw: string) {
  let s = raw.trim();
  if (/^webcals?:\/\//i.test(s)) s = s.replace(/^webcals?:\/\//i, "https://");
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new FetchProblem("That doesn't look like a link.");
  }
  if (isPrivateHost(url.hostname)) throw new FetchProblem("That link can't be opened from here.");
  return url;
}

export async function fetchText(raw: string, opts: { maxBytes?: number; accept?: string; timeoutMs?: number } = {}) {
  const url = cleanUrl(raw);
  const maxBytes = opts.maxBytes ?? 5_000_000;
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15000),
      headers: {
        accept: opts.accept ?? "*/*",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        "accept-language": "en-GB,en;q=0.9",
      },
    });
  } catch {
    throw new FetchProblem("That link didn't open. Check it and try again.");
  }
  if (res.url && isPrivateHost(new URL(res.url).hostname)) throw new FetchProblem("That link can't be opened from here.");
  if (!res.ok) throw new FetchProblem(`That link didn't open (the site said ${res.status}).`);
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new FetchProblem("That file is too big.");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.length;
  }
  return new TextDecoder("utf-8").decode(all);
}
