// Shared bits for the Siri shortcut routes: the personal key and replies Siri can read out.

export function bearer(request: Request) {
  const h = request.headers.get("authorization") ?? "";
  const m = h.match(/^\s*Bearer\s+([0-9a-f]{32,128})\s*$/i);
  return m ? m[1].toLowerCase() : null;
}

export function say(text: string, status = 200) {
  return new Response(text, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

export const BAD_KEY = "That Siri key isn't working. Open the planner, go to Family, then Siri shortcuts, and copy the key again.";

// "eggs, bread and bin bags"
export function spokenList(names: string[]) {
  const words = names.map((n) => (/^[A-Z][a-z]/.test(n) ? n.charAt(0).toLowerCase() + n.slice(1) : n));
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

export function addReply(added: string[], already: string[]) {
  const parts: string[] = [];
  if (added.length) parts.push(`Added ${spokenList(added)}.`);
  if (already.length) parts.push(`${capital(spokenList(already))} ${already.length === 1 ? "is" : "are"} already on the list.`);
  return parts.join(" ") || "I didn't catch anything to add.";
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Shortcuts can send the dictated text as JSON, a form or plain text
export async function readText(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  const raw = await request.text();
  // A list from Shortcuts may arrive as an array; keep one item per line
  const flat = (v: unknown): string => (Array.isArray(v) ? v.map(flat).join("\n") : v == null ? "" : String(v));
  if (type.includes("application/json") || /^\s*[{"[]/.test(raw)) {
    try {
      const j = JSON.parse(raw);
      if (typeof j === "string" || Array.isArray(j)) return flat(j);
      if (j && typeof j === "object") return flat(j.text ?? j.items ?? j.Text ?? j.Items ?? "");
    } catch {
      /* fall through to plain text */
    }
  }
  if (type.includes("application/x-www-form-urlencoded")) return new URLSearchParams(raw).getAll("text").join("\n");
  return raw;
}
