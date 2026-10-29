import { animalSvg, ANIMALS } from "./animals";
import { FAMILY_PORTRAITS, DEFAULT_PORTRAIT, parsePortrait, portraitSvg } from "./portrait";

// A member's picture is stored as text:
//   "p:<choices>" an adjustable portrait (see portrait.ts)
//   "a:<animal>"  one of the animal pictures (see animals.ts)
// Anything else (including old characters) falls back to a portrait.

const cache = new Map<string, string>();
const toUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export function avatarUri(avatar: string | null, name: string) {
  const key = avatar ?? `default:${name}`;
  let uri = cache.get(key);
  if (!uri) {
    if (avatar?.startsWith("a:") && ANIMALS.includes(avatar.slice(2))) uri = toUri(animalSvg(avatar.slice(2)));
    else uri = toUri(portraitSvg(parsePortrait(avatar) ?? FAMILY_PORTRAITS[name] ?? DEFAULT_PORTRAIT));
    cache.set(key, uri);
  }
  return uri;
}

// Bright, distinct colours that read well with white text
export const COLOURS = ["#3D7BF7", "#12A877", "#EE4C8A", "#FF9F1C", "#8B5CF6", "#06B6D4", "#E5484D", "#65A30D", "#D946EF", "#F97316"];
