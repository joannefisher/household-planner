// Server-side helper for asking Claude (Anthropic Messages API).
// Needs ANTHROPIC_API_KEY in Vercel; ANTHROPIC_MODEL optionally overrides the model.

export class ClaudeNotSetUp extends Error {}
export class ClaudeProblem extends Error {}

type Block =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

export async function askClaude(opts: { system: string; content: Block[]; maxTokens?: number }): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new ClaudeNotSetUp("Claude isn't set up yet. Add an ANTHROPIC_API_KEY in Vercel's settings.");
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
        max_tokens: opts.maxTokens ?? 2000,
        system: opts.system,
        messages: [{ role: "user", content: opts.content }],
      }),
      signal: AbortSignal.timeout(55000),
    });
  } catch {
    throw new ClaudeProblem("Couldn't reach Claude. Try again in a moment.");
  }
  if (res.status === 401) throw new ClaudeNotSetUp("The Claude API key isn't working. Check ANTHROPIC_API_KEY in Vercel.");
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Claude error", res.status, detail.slice(0, 400));
    throw new ClaudeProblem(res.status === 429 || res.status === 529 ? "Claude is busy. Try again in a minute." : "Claude couldn't answer that. Try again.");
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
}

// Pulls the first JSON object out of Claude's reply (it may wrap it in a code fence)
export function parseJson<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
