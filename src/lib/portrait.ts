// Hand-drawn, adjustable family portraits, built as SVG from a few choices.
// Stored on the member as "p:" + query string, e.g.
//   p:age=adult&hair=long-wavy&hc=6b4423&skin=f7d9c4&eyes=7d6a3a&glasses=0&beard=0

export type Portrait = {
  age: "adult" | "child" | "baby";
  hair: HairStyle;
  hc: string; // hair colour
  skin: string;
  eyes: string;
  glasses: boolean;
  beard: boolean;
  top: string; // clothes colour
};

export const HAIR_STYLES = {
  "long-wavy": "Long and wavy",
  "long-straight": "Long and straight",
  "long-fringe": "Long with a fringe",
  bob: "Bob",
  short: "Short",
  curly: "Short and curly",
  baby: "Baby wisps",
  bald: "None",
} as const;
export type HairStyle = keyof typeof HAIR_STYLES;

export const HAIR_COLOURS = ["2b1d14", "4a2c1a", "6b4423", "8c5a32", "b07a45", "e2bc74", "f1d58c", "b6472a", "9a9a9a", "e8e4dc"];
export const SKIN_TONES = ["fbe3d2", "f7d9c4", "f2cfb2", "efc4a4", "e0a982", "c98b62", "a86d47", "7f4f32", "5a3623"];
export const EYE_COLOURS = ["7d6a3a", "5a3a22", "3b2416", "4f86b8", "5aa38a", "6f8f4e", "8a8f98"];
export const TOP_COLOURS = ["5b3ff2", "3d7bf7", "12a877", "ee4c8a", "ff9f1c", "e5484d", "1f1b3a", "f2f0ea"];

export const DEFAULT_PORTRAIT: Portrait = {
  age: "adult",
  hair: "short",
  hc: "4a2c1a",
  skin: "f7d9c4",
  eyes: "5a3a22",
  glasses: false,
  beard: false,
  top: "5b3ff2",
};

export function parsePortrait(value: string | null): Portrait | null {
  if (!value?.startsWith("p:")) return null;
  const q = new URLSearchParams(value.slice(2));
  const hex = (k: string, d: string) => (/^[0-9a-f]{6}$/i.test(q.get(k) ?? "") ? q.get(k)! : d);
  const age = q.get("age");
  const hair = q.get("hair");
  return {
    age: age === "child" || age === "baby" ? age : "adult",
    hair: hair && hair in HAIR_STYLES ? (hair as HairStyle) : DEFAULT_PORTRAIT.hair,
    hc: hex("hc", DEFAULT_PORTRAIT.hc),
    skin: hex("skin", DEFAULT_PORTRAIT.skin),
    eyes: hex("eyes", DEFAULT_PORTRAIT.eyes),
    glasses: q.get("glasses") === "1",
    beard: q.get("beard") === "1",
    top: hex("top", DEFAULT_PORTRAIT.top),
  };
}

export function formatPortrait(p: Portrait) {
  const q = new URLSearchParams({
    age: p.age,
    hair: p.hair,
    hc: p.hc,
    skin: p.skin,
    eyes: p.eyes,
    glasses: p.glasses ? "1" : "0",
    beard: p.beard ? "1" : "0",
    top: p.top,
  });
  return `p:${q.toString()}`;
}

function shade(hex: string, amount: number) {
  const n = parseInt(hex, 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amount < 0 ? c : 255 - c) * amount)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function portraitSvg(p: Portrait): string {
  const baby = p.age === "baby";
  const child = p.age === "child";
  const skin = `#${p.skin}`;
  const skinDark = shade(p.skin, -0.14);
  const skinDeep = shade(p.skin, -0.32);
  const hair = `#${p.hc}`;
  const hairDark = shade(p.hc, -0.25);
  const hairBack = shade(p.hc, -0.12);
  const hairLight = shade(p.hc, 0.18);
  const top = `#${p.top}`;
  const iris = `#${p.eyes}`;

  // Head geometry: babies have big round heads and low features
  const cx = 100;
  const cy = baby ? 104 : child ? 98 : 94;
  const rx = baby ? 50 : child ? 44 : 43;
  const ry = baby ? 49 : child ? 48 : 52;
  const eyeY = baby ? cy + 6 : cy + 2;
  const eyeDx = baby ? 19 : 17;
  const eyeR = baby ? 7.2 : child ? 6.4 : 5.6;
  const browY = eyeY - (baby ? 15 : 14);
  const mouthY = baby ? cy + 27 : cy + 30;
  const chin = cy + ry;

  const parts: string[] = [];

  // Long hair falls behind the shoulders
  const backHair: Partial<Record<HairStyle, string>> = {
    "long-wavy": `M${cx - rx - 6} ${cy - 6} Q${cx - rx - 10} ${cy - ry - 8} ${cx} ${cy - ry - 10} Q${cx + rx + 10} ${cy - ry - 8} ${cx + rx + 6} ${cy - 6}
      Q${cx + rx + 18} ${cy + 22} ${cx + rx + 8} ${cy + 46} Q${cx + rx + 20} ${cy + 66} ${cx + rx + 6} ${cy + 88}
      L${cx - rx - 6} ${cy + 88} Q${cx - rx - 20} ${cy + 66} ${cx - rx - 8} ${cy + 46} Q${cx - rx - 18} ${cy + 22} ${cx - rx - 6} ${cy - 6} Z`,
    "long-straight": `M${cx - rx - 5} ${cy - 4} Q${cx - rx - 8} ${cy - ry - 8} ${cx} ${cy - ry - 10} Q${cx + rx + 8} ${cy - ry - 8} ${cx + rx + 5} ${cy - 4}
      L${cx + rx + 9} ${cy + 86} L${cx - rx - 9} ${cy + 86} Z`,
    "long-fringe": `M${cx - rx - 5} ${cy - 4} Q${cx - rx - 8} ${cy - ry - 8} ${cx} ${cy - ry - 10} Q${cx + rx + 8} ${cy - ry - 8} ${cx + rx + 5} ${cy - 4}
      L${cx + rx + 8} ${cy + 84} Q${cx} ${cy + 92} ${cx - rx - 8} ${cy + 84} Z`,
    bob: `M${cx - rx - 7} ${cy} Q${cx - rx - 8} ${cy - ry - 8} ${cx} ${cy - ry - 10} Q${cx + rx + 8} ${cy - ry - 8} ${cx + rx + 7} ${cy}
      L${cx + rx + 6} ${cy + 34} Q${cx} ${cy + 40} ${cx - rx - 6} ${cy + 34} Z`,
  };
  if (backHair[p.hair]) parts.push(`<path d="${backHair[p.hair]}" fill="${hairBack}"/>`);

  // Shoulders and neck
  const shoulderY = chin + (baby ? 10 : 14);
  parts.push(`<path d="M${cx - 76} 214 Q${cx - 72} ${shoulderY + 4} ${cx} ${shoulderY} Q${cx + 72} ${shoulderY + 4} ${cx + 76} 214 Z" fill="${top}"/>`);
  if (!baby) parts.push(`<rect x="${cx - 14}" y="${chin - 16}" width="28" height="${shoulderY - chin + 22}" rx="10" fill="${skinDark}"/>`);
  parts.push(`<path d="M${cx - 18} ${shoulderY + 1} Q${cx} ${shoulderY + 16} ${cx + 18} ${shoulderY + 1}" fill="none" stroke="${shade(p.top, -0.25)}" stroke-width="3" stroke-linecap="round"/>`);

  // Ears and face
  parts.push(`<ellipse cx="${cx - rx + 1}" cy="${eyeY + 4}" rx="7" ry="10" fill="${skinDark}"/>`);
  parts.push(`<ellipse cx="${cx + rx - 1}" cy="${eyeY + 4}" rx="7" ry="10" fill="${skinDark}"/>`);
  parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${skin}"/>`);

  // A short, neat beard along the jaw, with a moustache
  if (p.beard && !baby && !child) {
    parts.push(
      `<path d="M${cx - rx + 4} ${cy + 12} Q${cx - rx + 6} ${chin - 6} ${cx} ${chin + 2} Q${cx + rx - 6} ${chin - 6} ${cx + rx - 4} ${cy + 12}
        Q${cx + rx - 9} ${cy + 34} ${cx + 17} ${mouthY + 7} Q${cx} ${mouthY + 3} ${cx - 17} ${mouthY + 7} Q${cx - rx + 9} ${cy + 34} ${cx - rx + 4} ${cy + 12} Z" fill="${hair}" opacity="0.88"/>`,
      `<path d="M${cx - 15} ${mouthY - 3} Q${cx} ${mouthY - 11} ${cx + 15} ${mouthY - 3} Q${cx} ${mouthY - 6} ${cx - 15} ${mouthY - 3} Z" fill="${hair}"/>`,
    );
  }

  // Cheeks
  parts.push(`<circle cx="${cx - eyeDx - 9}" cy="${eyeY + 17}" r="${baby ? 9 : 7}" fill="#ff8a8a" opacity="${baby || child ? 0.38 : 0.26}"/>`);
  parts.push(`<circle cx="${cx + eyeDx + 9}" cy="${eyeY + 17}" r="${baby ? 9 : 7}" fill="#ff8a8a" opacity="${baby || child ? 0.38 : 0.26}"/>`);

  // Eyes: white, coloured iris, pupil, sparkle
  for (const side of [-1, 1]) {
    const ex = cx + side * eyeDx;
    parts.push(
      `<ellipse cx="${ex}" cy="${eyeY}" rx="${eyeR + 3}" ry="${eyeR + 2}" fill="#ffffff"/>`,
      `<circle cx="${ex}" cy="${eyeY + 0.5}" r="${eyeR}" fill="${iris}"/>`,
      `<circle cx="${ex}" cy="${eyeY + 0.5}" r="${eyeR * 0.5}" fill="#1b1410"/>`,
      `<circle cx="${ex + eyeR * 0.35}" cy="${eyeY - eyeR * 0.35}" r="${eyeR * 0.28}" fill="#ffffff"/>`,
      `<path d="M${ex - eyeR - 3} ${eyeY - 1} Q${ex} ${eyeY - eyeR - 5} ${ex + eyeR + 3} ${eyeY - 1}" fill="none" stroke="${skinDeep}" stroke-width="2.4" stroke-linecap="round"/>`,
    );
    if (!baby) {
      const bx = ex;
      parts.push(`<path d="M${bx - 9} ${browY + 2 * (side > 0 ? 0 : 0)} Q${bx} ${browY - 5} ${bx + 9} ${browY + 1}" fill="none" stroke="${hairDark}" stroke-width="${p.beard ? 4 : 3.2}" stroke-linecap="round"/>`);
    }
  }

  // Nose and mouth
  parts.push(`<path d="M${cx + 1} ${eyeY + 8} Q${cx - 4} ${eyeY + 17} ${cx + 2} ${eyeY + 19}" fill="none" stroke="${skinDeep}" stroke-width="2.4" stroke-linecap="round"/>`);
  if (baby) {
    parts.push(`<path d="M${cx - 9} ${mouthY - 2} Q${cx} ${mouthY + 8} ${cx + 9} ${mouthY - 2} Z" fill="#c4545c"/>`);
  } else {
    parts.push(`<path d="M${cx - 13} ${mouthY - 3} Q${cx} ${mouthY + 9} ${cx + 13} ${mouthY - 3} Q${cx} ${mouthY + 1} ${cx - 13} ${mouthY - 3} Z" fill="#b8454d"/>`);
    parts.push(`<path d="M${cx - 9} ${mouthY - 1} Q${cx} ${mouthY + 2} ${cx + 9} ${mouthY - 1}" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.85"/>`);
  }

  // Hair on top of the head
  const T = cy - ry; // top of head
  const front: Record<HairStyle, string> = {
    "long-wavy": `M${cx - rx - 4} ${cy + 8} Q${cx - rx - 10} ${T - 10} ${cx + 4} ${T - 8} Q${cx + rx + 10} ${T - 4} ${cx + rx + 4} ${cy + 8}
      Q${cx + rx - 2} ${cy - 22} ${cx + 18} ${T + 18} Q${cx - 6} ${T + 30} ${cx - 26} ${T + 22} Q${cx - rx + 2} ${cy - 18} ${cx - rx - 4} ${cy + 8} Z`,
    "long-straight": `M${cx - rx - 3} ${cy + 6} Q${cx - rx - 6} ${T - 10} ${cx} ${T - 9} Q${cx + rx + 6} ${T - 10} ${cx + rx + 3} ${cy + 6}
      Q${cx + rx - 4} ${cy - 24} ${cx + 4} ${T + 14} L${cx - 2} ${T + 14} Q${cx - rx + 4} ${cy - 24} ${cx - rx - 3} ${cy + 6} Z`,
    "long-fringe": `M${cx - rx - 3} ${cy + 4} Q${cx - rx - 6} ${T - 10} ${cx} ${T - 9} Q${cx + rx + 6} ${T - 10} ${cx + rx + 3} ${cy + 4}
      L${cx + rx - 4} ${browY - 2} Q${cx} ${browY + 4} ${cx - rx + 4} ${browY - 2} Z`,
    bob: `M${cx - rx - 5} ${cy + 10} Q${cx - rx - 8} ${T - 10} ${cx} ${T - 10} Q${cx + rx + 8} ${T - 10} ${cx + rx + 5} ${cy + 10}
      Q${cx + rx - 4} ${cy - 20} ${cx + 10} ${T + 16} Q${cx - 20} ${T + 22} ${cx - rx + 2} ${cy - 2} Z`,
    short: `M${cx - rx + 1} ${cy - 6} Q${cx - rx - 2} ${T - 10} ${cx + 2} ${T - 11} Q${cx + rx + 4} ${T - 8} ${cx + rx - 1} ${cy - 6}
      Q${cx + rx - 6} ${T + 16} ${cx + 12} ${T + 12} Q${cx - 14} ${T + 8} ${cx - rx + 8} ${T + 22} Q${cx - rx + 2} ${cy - 18} ${cx - rx + 1} ${cy - 6} Z`,
    curly: Array.from({ length: 9 }, (_, i) => {
      const a = Math.PI * (0.98 + (i / 8) * 1.04);
      const x = cx + Math.cos(a) * (rx + 2);
      const y = cy - 6 + Math.sin(a) * (ry + 4);
      return `M${x + 13} ${y} a13 13 0 1 0 -26 0 a13 13 0 1 0 26 0`;
    }).join(" "),
    baby: `M${cx - rx + 6} ${cy - 16} Q${cx - rx + 2} ${T - 2} ${cx} ${T - 6} Q${cx + rx - 2} ${T - 2} ${cx + rx - 6} ${cy - 16}
      Q${cx + 30} ${T + 14} ${cx + 12} ${T + 18} Q${cx - 2} ${T + 11} ${cx - 14} ${T + 19} Q${cx - 34} ${T + 16} ${cx - rx + 6} ${cy - 16} Z
      M${cx - 2} ${T - 4} q-6 -12 6 -14 q8 1 3 8 q-2 -4 -5 -2 z`,
    bald: "",
  };
  if (front[p.hair]) {
    parts.push(`<path d="${front[p.hair]}" fill="${hair}"/>`);
    if (p.hair.startsWith("long") || p.hair === "bob") {
      parts.push(`<path d="M${cx - 18} ${T + 2} Q${cx + 4} ${T - 6} ${cx + 22} ${T + 4}" fill="none" stroke="${hairLight}" stroke-width="4" stroke-linecap="round" opacity="0.6"/>`);
    }
  }
  if (p.hair === "short") {
    // sideburns
    parts.push(`<rect x="${cx - rx + 1}" y="${cy - 16}" width="7" height="${p.beard ? 30 : 18}" rx="3" fill="${hair}"/>`);
    parts.push(`<rect x="${cx + rx - 8}" y="${cy - 16}" width="7" height="${p.beard ? 30 : 18}" rx="3" fill="${hair}"/>`);
  }

  // Glasses on top
  if (p.glasses) {
    const w = eyeR * 2 + 12, h = eyeR * 2 + 9;
    for (const side of [-1, 1]) {
      const ex = cx + side * eyeDx;
      parts.push(`<rect x="${ex - w / 2}" y="${eyeY - h / 2}" width="${w}" height="${h}" rx="7" fill="#ffffff" fill-opacity="0.18" stroke="#2a2430" stroke-width="3"/>`);
    }
    parts.push(`<path d="M${cx - eyeDx + w / 2} ${eyeY - 1} Q${cx} ${eyeY - 6} ${cx + eyeDx - w / 2} ${eyeY - 1}" fill="none" stroke="#2a2430" stroke-width="3"/>`);
    parts.push(`<path d="M${cx - eyeDx - w / 2} ${eyeY - 2} L${cx - rx + 2} ${eyeY - 4} M${cx + eyeDx + w / 2} ${eyeY - 2} L${cx + rx - 2} ${eyeY - 4}" stroke="#2a2430" stroke-width="3"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${parts.join("")}</svg>`;
}

// The family as described, used as starting points
export const FAMILY_PORTRAITS: Record<string, Portrait> = {
  Joanne: { age: "adult", hair: "long-wavy", hc: "6b4423", skin: "f7d9c4", eyes: "7d6a3a", glasses: false, beard: false, top: "3d7bf7" },
  Aiden: { age: "adult", hair: "short", hc: "3b2416", skin: "f2cfb2", eyes: "5a3a22", glasses: true, beard: true, top: "12a877" },
  Millie: { age: "child", hair: "long-fringe", hc: "f1d58c", skin: "fbe3d2", eyes: "5aa38a", glasses: false, beard: false, top: "ee4c8a" },
  Zara: { age: "baby", hair: "baby", hc: "4a2c1a", skin: "fbe3d2", eyes: "7d6a3a", glasses: false, beard: false, top: "ff9f1c" },
};
