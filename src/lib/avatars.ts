import { createAvatar } from "@dicebear/core";
import * as adventurer from "@dicebear/adventurer";
import * as bigSmile from "@dicebear/big-smile";
import * as funEmoji from "@dicebear/fun-emoji";
import * as bottts from "@dicebear/bottts";
import * as toonHead from "@dicebear/toon-head";

// Characters are drawn in the browser from a style and a "seed" word, so nothing is stored but "style:seed".
export const STYLES = {
  adventurer: { label: "Adventurers", style: adventurer, credit: "Adventurer by Lisa Wischofsky (CC BY 4.0)" },
  "big-smile": { label: "Big smiles", style: bigSmile, credit: "Big Smile by Ashley Seo (CC BY 4.0)" },
  "toon-head": { label: "Toons", style: toonHead, credit: "Toon Head by Johan Melin (CC BY 4.0)" },
  "fun-emoji": { label: "Faces", style: funEmoji, credit: "Fun Emoji by Davis Uche (CC BY 4.0)" },
  bottts: { label: "Robots", style: bottts, credit: "Bottts by Pablo Stanley (free for personal and commercial use)" },
} as const;

export type StyleKey = keyof typeof STYLES;

const cache = new Map<string, string>();

export function parseAvatar(avatar: string | null, fallbackSeed: string): { style: StyleKey; seed: string } {
  const [style, ...rest] = (avatar ?? "").split(":");
  if (style in STYLES && rest.length) return { style: style as StyleKey, seed: rest.join(":") };
  return { style: "adventurer", seed: fallbackSeed };
}

export function avatarUri(avatar: string | null, fallbackSeed: string) {
  const key = avatar ?? `adventurer:${fallbackSeed}`;
  let uri = cache.get(key);
  if (!uri) {
    const { style, seed } = parseAvatar(avatar, fallbackSeed);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uri = createAvatar(STYLES[style].style as any, { seed, backgroundColor: ["transparent"] }).toDataUri();
    cache.set(key, uri);
  }
  return uri;
}

export function randomSeeds(n: number) {
  return Array.from({ length: n }, () => Math.random().toString(36).slice(2, 8));
}

// Bright, distinct colours that read well with white text
export const COLOURS = ["#3D7BF7", "#12A877", "#EE4C8A", "#FF9F1C", "#8B5CF6", "#06B6D4", "#E5484D", "#65A30D", "#D946EF", "#F97316"];
