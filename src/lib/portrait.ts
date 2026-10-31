// Hand-drawn, adjustable family portraits, built as SVG from a few choices.
// Stored on the member as "p:" + query string, e.g.
//   p:age=adult&hair=long-parted&hc=2b1d14&skin=f7d9c4&eyes=5a3a22&glasses=0&beard=0&top=f2f0ea

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
  "long-parted": "Long, middle parting",
  "long-wavy": "Long and wavy",
  "long-straight": "Long, side parting",
  "long-fringe": "Long with a fringe",
  bob: "Bob",
  swept: "Short, swept up",
  short: "Short",
  curly: "Short and curly",
  baby: "Baby wisps",
  bald: "None",
} as const;
export type HairStyle = keyof typeof HAIR_STYLES;

export const HAIR_COLOURS = ["1e1512", "2b1d14", "3b2416", "4a2c1a", "6b4423", "8c5a32", "b07a45", "d9b06a", "ecd29a", "b6472a", "9a9a9a", "e8e4dc"];
export const SKIN_TONES = ["fbe3d2", "f7d9c4", "f2cfb2", "efc4a4", "e0a982", "c98b62", "a86d47", "7f4f32", "5a3623"];
export const EYE_COLOURS = ["7d6a3a", "5a3a22", "3b2416", "4f86b8", "6d8fae", "5aa38a", "6f8f4e", "8a8f98"];
export const TOP_COLOURS = ["9aa0a8", "f2f0ea", "f6c6d8", "5b3ff2", "3d7bf7", "12a877", "ee4c8a", "ff9f1c", "e5484d", "1f1b3a"];

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

// Lighten (amount > 0) or darken (amount < 0) a hex colour
function shade(hex: string, amount: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amount < 0 ? c : 255 - c) * amount)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// Mix two hex colours
function mix(a: string, b: string, t: number) {
  const x = parseInt(a.replace("#", ""), 16), y = parseInt(b.replace("#", ""), 16);
  const c = (s: number) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return `#${((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1)}`;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

// Geometry for each age: head size and where the features sit
const GEO = {
  adult: { cy: 90, rx: 40, ry: 49, jaw: 0.6, eyeDy: 3, eyeDx: 16, eyeW: 8, eyeH: 6.6, iris: 5.4, brow: 13, nose: 19, mouth: 31, neck: 13, shoulder: 12 },
  child: { cy: 94, rx: 41.5, ry: 46, jaw: 0.76, eyeDy: 6, eyeDx: 16.5, eyeW: 8.4, eyeH: 7.6, iris: 6.2, brow: 13, nose: 15, mouth: 26, neck: 11, shoulder: 10 },
  baby: { cy: 100, rx: 47, ry: 45, jaw: 0.92, eyeDy: 9, eyeDx: 18.5, eyeW: 9, eyeH: 8.6, iris: 7, brow: 14, nose: 13, mouth: 22, neck: 0, shoulder: 4 },
} as const;

export function portraitSvg(p: Portrait): string {
  const baby = p.age === "baby";
  const child = p.age === "child";
  const adult = !baby && !child;
  const g = GEO[p.age];

  // ---- Colours ----
  const skin = `#${p.skin}`;
  const skinHi = shade(p.skin, 0.28);
  const skinMid = mix(shade(p.skin, -0.08), "#d46a5e", 0.06);
  const skinShadow = mix(shade(p.skin, -0.2), "#b85a50", 0.16);
  const skinDeep = mix(shade(p.skin, -0.45), "#6e2e28", 0.25);
  const hair = `#${p.hc}`;
  const hairHi = shade(p.hc, 0.42);
  const hairLo = shade(p.hc, -0.38);
  const fair = parseInt(p.hc.slice(0, 2), 16) > 150;
  const browCol = fair ? shade(p.hc, -0.35) : shade(p.hc, -0.25);
  const lash = fair ? mix(shade(p.hc, -0.7), "#2a1a14", 0.6) : "#1f1612";
  const topLight = parseInt(p.top.slice(0, 2), 16) + parseInt(p.top.slice(2, 4), 16) + parseInt(p.top.slice(4, 6), 16) > 600;

  // ---- Geometry ----
  const cx = 100;
  const { cy, rx, ry, jaw } = g;
  const T = cy - ry;
  const chin = cy + ry;
  const eyeY = cy + g.eyeDy;
  const browY = eyeY - g.brow;
  const noseY = eyeY + g.nose;
  const mouthY = eyeY + g.mouth;
  const shoulderY = chin + g.shoulder;

  const defs: string[] = [
    `<filter id="b07" filterUnits="userSpaceOnUse" x="-20" y="-20" width="240" height="240"><feGaussianBlur stdDeviation="0.6"/></filter>`,
    `<filter id="b1" filterUnits="userSpaceOnUse" x="-20" y="-20" width="240" height="240"><feGaussianBlur stdDeviation="1"/></filter>`,
    `<filter id="b2" filterUnits="userSpaceOnUse" x="-20" y="-20" width="240" height="240"><feGaussianBlur stdDeviation="2.2"/></filter>`,
    `<filter id="b4" filterUnits="userSpaceOnUse" x="-20" y="-20" width="240" height="240"><feGaussianBlur stdDeviation="4"/></filter>`,
    `<radialGradient id="sk" cx="0.4" cy="0.36" r="0.72"><stop offset="0" stop-color="${skinHi}"/><stop offset="0.5" stop-color="${skin}"/><stop offset="1" stop-color="${skinMid}"/></radialGradient>`,
    `<linearGradient id="hr" x1="0.2" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${shade(p.hc, 0.16)}"/><stop offset="0.45" stop-color="${hair}"/><stop offset="1" stop-color="${hairLo}"/></linearGradient>`,
    `<linearGradient id="hb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(p.hc, -0.2)}"/><stop offset="1" stop-color="${shade(p.hc, -0.5)}"/></linearGradient>`,
    `<linearGradient id="tp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(p.top, topLight ? 0.3 : 0.14)}"/><stop offset="1" stop-color="${shade(p.top, topLight ? -0.1 : -0.16)}"/></linearGradient>`,
    `<radialGradient id="ir" cx="0.5" cy="0.62" r="0.55"><stop offset="0" stop-color="${shade(p.eyes, 0.45)}"/><stop offset="0.55" stop-color="#${p.eyes}"/><stop offset="1" stop-color="${shade(p.eyes, -0.5)}"/></radialGradient>`,
    `<linearGradient id="nk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skinShadow}"/><stop offset="1" stop-color="${skinMid}"/></linearGradient>`,
  ];
  const parts: string[] = [];

  const face =
    `M${cx} ${T} C${cx + rx * 0.6} ${T} ${cx + rx} ${cy - ry * 0.56} ${cx + rx} ${cy - ry * 0.04}` +
    ` C${cx + rx} ${cy + ry * 0.42} ${cx + rx * jaw} ${chin - ry * 0.06} ${cx} ${chin}` +
    ` C${cx - rx * jaw} ${chin - ry * 0.06} ${cx - rx} ${cy + ry * 0.42} ${cx - rx} ${cy - ry * 0.04}` +
    ` C${cx - rx} ${cy - ry * 0.56} ${cx - rx * 0.6} ${T} ${cx} ${T} Z`;
  defs.push(`<clipPath id="fc"><path d="${face}"/></clipPath>`);

  // ---- Hair shapes (worked out first; drawn later in layers) ----
  const back: string[] = [];
  const front: string[] = [];
  const sheen: string[] = [];
  const lines: string[] = [];
  const longBack = (len: number, width = 14) =>
    `M${cx} ${T - 9} C${cx - rx - width - 2} ${T - 9} ${cx - rx - width} ${cy + 6} ${cx - rx - width} ${cy + 40} L${cx - rx - width + 2} ${len - 8} Q${cx} ${len + 8} ${cx + rx + width - 2} ${len - 8} L${cx + rx + width} ${cy + 40} C${cx + rx + width} ${cy + 6} ${cx + rx + width + 2} ${T - 9} ${cx} ${T - 9} Z`;

  // A curtain of hair from the parting, round the temple and down past the face
  const curtain = (side: number, part: number, len: number, wave: boolean, tuck = false) => {
    const x = (d: number) => r1(cx + side * d);
    const outer = wave
      ? `Q${x(rx + 19)} ${cy + 16} ${x(rx + 11)} ${cy + 34} Q${x(rx + 3)} ${cy + 52} ${x(rx + 13)} ${cy + 70} Q${x(rx + 22)} ${cy + 86} ${x(rx + 14)} ${len}`
      : tuck
        ? `C${x(rx + 12)} ${cy + 14} ${x(rx + 13)} ${len - 14} ${x(rx + 9)} ${len}`
        : `C${x(rx + 13)} ${cy + 24} ${x(rx + 9)} ${cy + 60} ${x(rx + 17)} ${len}`;
    const tip = tuck
      ? `Q${x(rx + 2)} ${len + 4} ${x(rx - 6)} ${len - 4}`
      : `Q${x(rx + 9)} ${len + 7} ${x(rx - 1)} ${len - 1}`;
    return `M${part} ${T - 8} C${r1(part + side * 22)} ${T - 11} ${x(rx + 12)} ${T + 6} ${x(rx + 11)} ${cy - 4} ${outer} ${tip}
      C${x(rx - 4)} ${len - 30} ${x(rx - 6)} ${cy + 24} ${x(rx - 6)} ${cy + 2} C${x(rx - 6)} ${T + 28} ${r1(part + side * 16)} ${T + 6} ${part} ${T + 3} Z`;
  };

  switch (p.hair) {
    case "long-parted":
      back.push(longBack(cy + 100));
      front.push(curtain(-1, cx, cy + 102, false), curtain(1, cx, cy + 102, false));
      sheen.push(`M${cx - 7} ${T - 3} C${cx - 20} ${T - 1} ${cx - 29} ${T + 6} ${cx - 33} ${T + 17}`, `M${cx + 7} ${T - 3} C${cx + 20} ${T - 1} ${cx + 29} ${T + 6} ${cx + 33} ${T + 17}`);
      lines.push(`M${cx - rx - 4} ${cy + 14} C${cx - rx - 4} ${cy + 50} ${cx - rx - 1} ${cy + 76} ${cx - rx + 1} ${cy + 96}`, `M${cx + rx + 4} ${cy + 14} C${cx + rx + 4} ${cy + 50} ${cx + rx + 1} ${cy + 76} ${cx + rx - 1} ${cy + 96}`);
      break;
    case "long-wavy":
      back.push(longBack(cy + 100, 18));
      front.push(curtain(-1, cx - 10, cy + 100, true), curtain(1, cx - 10, cy + 100, true));
      sheen.push(`M${cx - 2} ${T - 4} C${cx + 14} ${T - 4} ${cx + 26} ${T + 2} ${cx + 32} ${T + 14}`);
      break;
    case "long-straight": {
      // side parting, the long side sweeping over the forehead
      back.push(longBack(cy + 100));
      front.push(curtain(-1, cx - 14, cy + 100, false));
      front.push(`M${cx - 14} ${T - 7} C${cx + 8} ${T - 11} ${cx + rx + 10} ${T + 6} ${cx + rx + 10} ${cy - 4} C${cx + rx + 11} ${cy + 30} ${cx + rx + 13} ${cy + 66} ${cx + rx + 16} ${cy + 100}
        Q${cx + rx + 9} ${cy + 107} ${cx + rx - 1} ${cy + 99} C${cx + rx - 4} ${cy + 70} ${cx + rx - 6} ${cy + 24} ${cx + rx - 6} ${cy + 2} C${cx + rx - 7} ${T + 32} ${cx + 18} ${T + 20} ${cx - 2} ${T + 16} C${cx - 8} ${T + 12} ${cx - 12} ${T + 6} ${cx - 14} ${T + 3} Z`);
      sheen.push(`M${cx - 6} ${T - 4} C${cx + 10} ${T - 5} ${cx + 24} ${T + 1} ${cx + 32} ${T + 12}`);
      break;
    }
    case "long-fringe":
      back.push(longBack(cy + 96));
      front.push(`M${cx - rx - 10} ${cy + 96} C${cx - rx - 12} ${cy + 40} ${cx - rx - 12} ${T - 2} ${cx} ${T - 9} C${cx + rx + 12} ${T - 2} ${cx + rx + 12} ${cy + 40} ${cx + rx + 10} ${cy + 96}
        Q${cx + rx + 4} ${cy + 102} ${cx + rx - 3} ${cy + 94} C${cx + rx - 5} ${cy + 50} ${cx + rx - 6} ${cy + 10} ${cx + rx - 6} ${browY + 2}
        C${cx + 24} ${browY + 6} ${cx + 12} ${browY + 2} ${cx} ${browY + 4} C${cx - 12} ${browY + 2} ${cx - 24} ${browY + 6} ${cx - rx + 6} ${browY + 2}
        C${cx - rx + 6} ${cy + 10} ${cx - rx + 5} ${cy + 50} ${cx - rx + 3} ${cy + 94} Q${cx - rx - 4} ${cy + 102} ${cx - rx - 10} ${cy + 96} Z`);
      sheen.push(`M${cx - 22} ${T + 2} Q${cx} ${T - 8} ${cx + 22} ${T + 2}`);
      lines.push(`M${cx - 14} ${T + 10} Q${cx - 16} ${browY - 6} ${cx - 18} ${browY + 2} M${cx + 2} ${T + 8} Q${cx + 2} ${browY - 6} ${cx + 3} ${browY + 3} M${cx + 18} ${T + 10} Q${cx + 20} ${browY - 6} ${cx + 22} ${browY + 1}`);
      break;
    case "bob":
      back.push(longBack(cy + 34, 13));
      front.push(curtain(-1, cx - 8, cy + 32, false, true), curtain(1, cx - 8, cy + 32, false, true));
      sheen.push(`M${cx + 2} ${T - 4} C${cx + 16} ${T - 4} ${cx + 26} ${T + 2} ${cx + 32} ${T + 14}`);
      break;
    case "swept": {
      // short sides, height on top, swept up and back
      const hl = T + 13;
      front.push(`M${cx - rx + 1} ${cy - 2} C${cx - rx - 5} ${T + 4} ${cx - rx + 4} ${T - 13} ${cx - 6} ${T - 15} C${cx + 18} ${T - 19} ${cx + rx + 6} ${T - 6} ${cx + rx - 1} ${cy - 2}
        C${cx + rx - 4} ${hl + 8} ${cx + rx - 10} ${hl - 3} ${cx + 22} ${hl - 1} C${cx + 10} ${hl + 2} ${cx} ${hl + 2} ${cx - 10} ${hl} C${cx - 20} ${hl - 2} ${cx - rx + 8} ${hl - 2} ${cx - rx + 6} ${hl + 6} C${cx - rx + 3} ${hl + 14} ${cx - rx + 3} ${cy - 10} ${cx - rx + 1} ${cy - 2} Z`);
      sheen.push(`M${cx - 14} ${T - 9} Q${cx + 4} ${T - 17} ${cx + 22} ${T - 10}`);
      lines.push(`M${cx - 18} ${hl - 1} Q${cx - 16} ${T} ${cx - 4} ${T - 9} M${cx - 2} ${hl + 1} Q${cx} ${T - 1} ${cx + 12} ${T - 9} M${cx + 14} ${hl} Q${cx + 18} ${T + 2} ${cx + 26} ${T - 3}`);
      break;
    }
    case "short": {
      const hl = T + 14;
      front.push(`M${cx - rx + 1} ${cy - 2} C${cx - rx - 4} ${T + 2} ${cx - 16} ${T - 12} ${cx + 2} ${T - 11} C${cx + 22} ${T - 11} ${cx + rx + 5} ${T + 2} ${cx + rx - 1} ${cy - 2}
        C${cx + rx - 4} ${hl + 10} ${cx + rx - 8} ${hl} ${cx + 20} ${hl - 2} C${cx + 4} ${hl - 4} ${cx - 12} ${hl + 2} ${cx - 24} ${hl + 2} C${cx - rx + 8} ${hl + 2} ${cx - rx + 3} ${hl + 12} ${cx - rx + 1} ${cy - 2} Z`);
      sheen.push(`M${cx - 12} ${T - 6} Q${cx + 4} ${T - 11} ${cx + 20} ${T - 5}`);
      break;
    }
    case "curly": {
      const blobs = Array.from({ length: 13 }, (_, i) => {
        const a = Math.PI * (0.97 + (i / 12) * 1.06);
        return [cx + Math.cos(a) * (rx - 1), cy - 10 + Math.sin(a) * (ry - 2)];
      });
      front.push(
        `M${cx - rx + 2} ${cy - 6} C${cx - rx} ${T} ${cx - 20} ${T - 6} ${cx} ${T - 6} C${cx + 20} ${T - 6} ${cx + rx} ${T} ${cx + rx - 2} ${cy - 6} C${cx + rx - 8} ${T + 18} ${cx + 10} ${T + 14} ${cx} ${T + 16} C${cx - 10} ${T + 14} ${cx - rx + 8} ${T + 18} ${cx - rx + 2} ${cy - 6} Z`,
        blobs.map(([x, y]) => `M${r1(x + 11.5)} ${r1(y)} a11.5 11.5 0 1 0 -23 0 a11.5 11.5 0 1 0 23 0`).join(" "),
      );
      lines.push(blobs.map(([x, y]) => `M${r1(x - 5)} ${r1(y + 3)} q5 -7 10 0`).join(" "));
      sheen.push(`M${cx - 16} ${T - 4} Q${cx} ${T - 10} ${cx + 16} ${T - 4}`);
      break;
    }
    case "baby":
    case "bald":
      break;
  }

  // ---- Back hair ----
  for (const d of back) parts.push(`<path d="${d}" fill="url(#hb)"/>`);

  // ---- Shoulders and neck ----
  const sw = adult ? 86 : child ? 74 : 72;
  parts.push(`<path d="M${cx - sw - 4} 204 C${cx - sw} ${shoulderY + 14} ${cx - sw * 0.62} ${shoulderY} ${cx - 18} ${shoulderY} L${cx + 18} ${shoulderY} C${cx + sw * 0.62} ${shoulderY} ${cx + sw} ${shoulderY + 14} ${cx + sw + 4} 204 Z" fill="url(#tp)"/>`);
  if (!baby) {
    const nw = g.neck;
    const neck = `M${cx - nw} ${chin - 24} L${cx - nw - 1} ${shoulderY + 2} Q${cx} ${shoulderY + 16} ${cx + nw + 1} ${shoulderY + 2} L${cx + nw} ${chin - 24} Z`;
    defs.push(`<clipPath id="nc"><path d="${neck}"/></clipPath>`);
    parts.push(`<path d="${neck}" fill="url(#nk)"/>`);
    parts.push(`<ellipse clip-path="url(#nc)" cx="${cx}" cy="${chin + 1}" rx="${nw + 6}" ry="9" fill="${skinDeep}" opacity="0.35" filter="url(#b2)"/>`);
    // crew neck collar
    parts.push(`<path d="M${cx - nw - 7} ${shoulderY - 1} Q${cx} ${shoulderY + 18} ${cx + nw + 7} ${shoulderY - 1}" fill="none" stroke="${shade(p.top, topLight ? -0.14 : -0.24)}" stroke-width="4" stroke-linecap="round"/>`);
  } else {
    // sleepsuit with a soft collar
    parts.push(`<path d="M${cx - 26} ${shoulderY + 1} Q${cx} ${shoulderY + 20} ${cx + 26} ${shoulderY + 1}" fill="none" stroke="${shade(p.top, -0.14)}" stroke-width="3.5" stroke-linecap="round"/>`);
  }
  // shadow cast by the head onto the top
  parts.push(`<ellipse cx="${cx}" cy="${shoulderY + 4}" rx="${baby ? 34 : 30}" ry="6" fill="#000" opacity="0.1" filter="url(#b2)"/>`);

  // ---- Ears ----
  for (const side of [-1, 1]) {
    const ex = cx + side * (rx - 1.5);
    parts.push(`<ellipse cx="${ex}" cy="${eyeY + 6}" rx="${baby ? 7.5 : 7}" ry="${baby ? 9.5 : 10.5}" fill="${skinMid}"/>`);
    parts.push(`<ellipse cx="${ex + side * 1.5}" cy="${eyeY + 6}" rx="3.2" ry="6" fill="${skinShadow}" opacity="0.7" filter="url(#b1)"/>`);
  }

  // ---- Face ----
  parts.push(`<path d="${face}" fill="url(#sk)"/>`);
  parts.push(
    `<g clip-path="url(#fc)">` +
      // soft shading down the right side and along the jaw
      `<ellipse cx="${cx + rx + 6}" cy="${cy + 8}" rx="14" ry="${ry}" fill="${skinShadow}" opacity="0.5" filter="url(#b4)"/>` +
      `<ellipse cx="${cx}" cy="${chin + 6}" rx="${rx * 0.8}" ry="10" fill="${skinShadow}" opacity="0.35" filter="url(#b4)"/>` +
      // cheeks
      `<ellipse cx="${cx - g.eyeDx - 6}" cy="${eyeY + 15}" rx="${baby ? 10 : 8.5}" ry="${baby ? 7 : 5.5}" fill="#ff6f6f" opacity="${baby || child ? 0.35 : 0.22}" filter="url(#b2)"/>` +
      `<ellipse cx="${cx + g.eyeDx + 6}" cy="${eyeY + 15}" rx="${baby ? 10 : 8.5}" ry="${baby ? 7 : 5.5}" fill="#ff6f6f" opacity="${baby || child ? 0.35 : 0.22}" filter="url(#b2)"/>` +
      // forehead and cheekbone highlights
      `<ellipse cx="${cx - 8}" cy="${T + ry * 0.38}" rx="14" ry="8" fill="#ffffff" opacity="0.22" filter="url(#b4)"/>` +
    `</g>`,
  );

  // ---- Beard ----
  if (p.beard && adult) {
    defs.push(`<linearGradient id="bd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hair}" stop-opacity="0.65"/><stop offset="0.3" stop-color="${hair}" stop-opacity="0.95"/><stop offset="1" stop-color="${hairLo}"/></linearGradient>`);
    const top0 = eyeY + 13;
    const beard = `M${cx - rx + 0.5} ${cy - 8} C${cx - rx + 2} ${top0 + 6} ${cx - rx + 6} ${top0 + 12} ${cx - rx + 11} ${top0 + 15}
      C${cx - 20} ${mouthY - 10} ${cx - 10} ${mouthY - 9} ${cx} ${mouthY - 9} C${cx + 10} ${mouthY - 9} ${cx + 20} ${mouthY - 10} ${cx + rx - 11} ${top0 + 15}
      C${cx + rx - 6} ${top0 + 12} ${cx + rx - 2} ${top0 + 6} ${cx + rx - 0.5} ${cy - 8}
      C${cx + rx + 1.5} ${cy + ry * 0.48} ${cx + rx * 0.72} ${chin + 5} ${cx} ${chin + 9} C${cx - rx * 0.72} ${chin + 5} ${cx - rx - 1.5} ${cy + ry * 0.48} ${cx - rx + 0.5} ${cy - 8} Z`;
    parts.push(`<path d="${beard}" clip-path="url(#fc)" fill="${hair}" opacity="0.3" filter="url(#b2)"/>`);
    parts.push(`<path d="${beard}" fill="url(#bd)" filter="url(#b07)"/>`);
    parts.push(`<path d="M${cx - 12} ${chin - 2} Q${cx} ${chin + 4} ${cx + 12} ${chin - 2}" fill="none" stroke="${shade(p.hc, 0.3)}" stroke-width="3" opacity="0.25" filter="url(#b1)"/>`);
  }

  // ---- Eyes ----
  for (const side of [-1, 1]) {
    const ex = cx + side * g.eyeDx;
    const w = g.eyeW, h = g.eyeH;
    const inner = ex - side * w, outer = ex + side * w;
    const upper = `M${inner} ${eyeY + 1} C${inner + side * w * 0.3} ${eyeY - h * 1.05} ${outer - side * w * 0.45} ${eyeY - h * 1.15} ${outer} ${eyeY - 0.5}`;
    const eye = `${upper} C${outer - side * w * 0.3} ${eyeY + h * 0.85} ${inner + side * w * 0.35} ${eyeY + h * 0.9} ${inner} ${eyeY + 1} Z`;
    const clip = side > 0 ? "er" : "el";
    defs.push(`<clipPath id="${clip}"><path d="${eye}"/></clipPath>`);
    // soft lid shading above the eye
    parts.push(`<ellipse cx="${ex}" cy="${eyeY - h * 0.7}" rx="${w + 3}" ry="${h * 0.8}" fill="${skinShadow}" opacity="${adult ? 0.3 : 0.18}" filter="url(#b2)"/>`);
    parts.push(`<path d="${eye}" fill="#fdfbf8"/>`);
    parts.push(
      `<g clip-path="url(#${clip})">` +
        `<circle cx="${ex + side * 0.4}" cy="${eyeY + 0.6}" r="${g.iris}" fill="url(#ir)"/>` +
        `<circle cx="${ex + side * 0.4}" cy="${eyeY + 0.6}" r="${g.iris * 0.46}" fill="#120c0a"/>` +
        `<path d="${upper}" fill="none" stroke="${skinDeep}" stroke-width="4" opacity="0.22" filter="url(#b1)"/>` +
      `</g>`,
    );
    parts.push(`<circle cx="${ex + side * 0.4 + g.iris * 0.38}" cy="${eyeY + 0.6 - g.iris * 0.4}" r="${g.iris * 0.3}" fill="#fff"/>`);
    parts.push(`<circle cx="${ex + side * 0.4 - g.iris * 0.38}" cy="${eyeY + 0.6 + g.iris * 0.38}" r="${g.iris * 0.13}" fill="#fff" opacity="0.8"/>`);
    // upper lash line: a filled crescent, thicker towards the outer corner, with a small flick
    const flick = !p.beard && !baby;
    parts.push(
      `<path d="${upper} L${outer + side * (flick ? 2.6 : 0.6)} ${eyeY - (flick ? 3 : 1.6)} C${outer - side * w * 0.45} ${eyeY - h * 1.15 - 2.6} ${inner + side * w * 0.3} ${eyeY - h * 1.05 - 1.4} ${inner - side * 0.4} ${eyeY} Z" fill="${lash}"/>`,
    );
    // eyebrows: smooth, tapered
    if (!baby) {
      const bIn = ex - side * (w + 1.5), bOut = ex + side * (w + 4);
      const th = p.beard ? 3.8 : child ? 2.6 : 3;
      parts.push(`<path d="M${bIn} ${browY + 2.5} C${bIn + side * 4} ${browY - 2.5} ${bOut - side * 6} ${browY - 3.5} ${bOut} ${browY + 1.5} C${bOut - side * 6} ${browY - 3.5 + th * 0.6} ${bIn + side * 4} ${browY - 2.5 + th} ${bIn} ${browY + 2.5 + th * 0.8} Z" fill="${browCol}" opacity="${fair ? 0.8 : 0.95}"/>`);
    } else {
      parts.push(`<path d="M${ex - side * 7} ${browY + 2} Q${ex} ${browY - 2} ${ex + side * 8} ${browY + 2}" fill="none" stroke="${shade(p.hc, -0.1)}" stroke-width="2" stroke-linecap="round" opacity="0.3" filter="url(#b1)"/>`);
    }
  }

  // ---- Nose: soft shadows, no outlines ----
  const nw = baby ? 5 : child ? 5.5 : 6.5;
  if (!baby) parts.push(`<path d="M${cx + 3} ${eyeY + 4} C${cx + 5} ${noseY - 10} ${cx + 6} ${noseY - 6} ${cx + nw} ${noseY}" fill="none" stroke="${skinShadow}" stroke-width="3.5" stroke-linecap="round" opacity="0.5" filter="url(#b1)"/>`);
  parts.push(`<ellipse cx="${cx}" cy="${noseY + 2}" rx="${nw + 1}" ry="${baby ? 3 : 3.4}" fill="${skinShadow}" opacity="0.75" filter="url(#b1)"/>`);
  parts.push(`<ellipse cx="${cx - nw * 0.55}" cy="${noseY + 2.4}" rx="1.6" ry="1.1" fill="${skinDeep}" opacity="0.55"/>`);
  parts.push(`<ellipse cx="${cx + nw * 0.55}" cy="${noseY + 2.4}" rx="1.6" ry="1.1" fill="${skinDeep}" opacity="0.55"/>`);
  parts.push(`<ellipse cx="${cx - 1}" cy="${noseY - 1}" rx="${nw * 0.5}" ry="2.2" fill="#fff" opacity="0.4" filter="url(#b1)"/>`);

  // ---- Mouth: a clean open smile ----
  const mw = baby ? 6.5 : p.beard ? 11.5 : child ? 11 : 12;
  const mh = baby ? 4.5 : p.beard ? 7 : 8;
  const mouth = `M${cx - mw} ${mouthY} C${cx - mw * 0.5} ${mouthY + 1.8} ${cx + mw * 0.5} ${mouthY + 1.8} ${cx + mw} ${mouthY} C${cx + mw * 0.85} ${mouthY + mh} ${cx + mw * 0.45} ${mouthY + mh + 1} ${cx} ${mouthY + mh + 1} C${cx - mw * 0.45} ${mouthY + mh + 1} ${cx - mw * 0.85} ${mouthY + mh} ${cx - mw} ${mouthY} Z`;
  defs.push(`<clipPath id="mc"><path d="${mouth}"/></clipPath>`);
  if (!p.beard) parts.push(`<ellipse cx="${cx}" cy="${mouthY + mh + 5}" rx="${mw * 0.6}" ry="2.5" fill="${skinShadow}" opacity="0.5" filter="url(#b1)"/>`);
  parts.push(`<path d="${mouth}" fill="#6a2430"/>`);
  parts.push(
    `<g clip-path="url(#mc)">` +
      (baby ? "" : `<path d="M${cx - mw * 0.8} ${mouthY - 2} L${cx + mw * 0.8} ${mouthY - 2} L${cx + mw * 0.72} ${mouthY + mh * 0.42} Q${cx} ${mouthY + mh * 0.52} ${cx - mw * 0.72} ${mouthY + mh * 0.42} Z" fill="#fbf8f2"/>`) +
      `<ellipse cx="${cx}" cy="${mouthY + mh + 1.5}" rx="${mw * 0.6}" ry="${mh * 0.45}" fill="#e06a76"/>` +
    `</g>`,
  );
  // Moustache over the top lip
  if (p.beard && adult) {
    parts.push(`<path d="M${cx - mw - 4} ${mouthY + 1} C${cx - mw - 2} ${mouthY - 8} ${cx - 5} ${mouthY - 11} ${cx} ${mouthY - 8} C${cx + 5} ${mouthY - 11} ${cx + mw + 2} ${mouthY - 8} ${cx + mw + 4} ${mouthY + 1} C${cx + 8} ${mouthY - 2.5} ${cx + 3} ${mouthY - 2.5} ${cx} ${mouthY - 1.5} C${cx - 3} ${mouthY - 2.5} ${cx - 8} ${mouthY - 2.5} ${cx - mw - 4} ${mouthY + 1} Z" fill="${hair}" filter="url(#b1)"/>`);
  }

  // ---- Hair on top ----
  if (p.hair === "baby") {
    parts.push(`<path d="M${cx - rx + 9} ${cy - 16} C${cx - rx + 4} ${T + 4} ${cx - 16} ${T - 4} ${cx} ${T - 4} C${cx + 16} ${T - 4} ${cx + rx - 4} ${T + 4} ${cx + rx - 9} ${cy - 16}
      C${cx + 26} ${T + 12} ${cx + 10} ${T + 10} ${cx} ${T + 12} C${cx - 10} ${T + 10} ${cx - 26} ${T + 12} ${cx - rx + 9} ${cy - 16} Z" fill="${hair}" opacity="0.45" filter="url(#b2)"/>`);
    parts.push(`<path d="M${cx - 2} ${T - 1} q-4 -12 7 -12 q7 2 2 8 q-1 -4 -5 -2" fill="none" stroke="${hair}" stroke-width="2.6" stroke-linecap="round" opacity="0.85"/>`);
  }
  if (front.length) {
    // shadow the hair casts on the forehead
    parts.push(`<g clip-path="url(#fc)" opacity="0.45">${front.map((d) => `<path d="${d}" transform="translate(${baby ? 0 : 1.5} 5)" fill="${skinDeep}" filter="url(#b2)"/>`).join("")}</g>`);
    // short styles: sideburns
    if (p.hair === "swept" || p.hair === "short") {
      for (const side of [-1, 1]) {
        const x = (d: number) => cx + side * d;
        parts.push(`<path d="M${x(rx - 0.5)} ${cy - 16} C${x(rx - 4)} ${cy - 16} ${x(rx - 6)} ${cy - 12} ${x(rx - 5.5)} ${cy - 4} C${x(rx - 4.5)} ${eyeY + 4} ${x(rx - (p.beard ? 7 : 4))} ${eyeY + (p.beard ? 18 : 8)} ${x(rx - (p.beard ? 5 : 2))} ${eyeY + (p.beard ? 26 : 10)} L${x(rx - 0.5)} ${eyeY + (p.beard ? 24 : 10)} Z" fill="${hair}"/>`);
      }
    }
    for (const d of front) parts.push(`<path d="${d}" fill="url(#hr)"/>`);
    for (const d of lines) parts.push(`<path d="${d}" fill="none" stroke="${hairLo}" stroke-width="1.3" stroke-linecap="round" opacity="0.3"/>`);
    for (const d of sheen) parts.push(`<path d="${d}" fill="none" stroke="${hairHi}" stroke-width="5" stroke-linecap="round" opacity="0.45" filter="url(#b2)"/>`);
  }

  // ---- Glasses ----
  if (p.glasses) {
    const w = g.eyeW * 2 + 9, h = g.eyeH * 2 + 10;
    for (const side of [-1, 1]) {
      const ex = cx + side * g.eyeDx;
      parts.push(`<rect x="${ex - w / 2}" y="${eyeY - h / 2}" width="${w}" height="${h}" rx="7" fill="#ffffff" fill-opacity="0.14" stroke="#262230" stroke-width="2.6"/>`);
    }
    parts.push(`<path d="M${cx - g.eyeDx + w / 2} ${eyeY - 2} Q${cx} ${eyeY - 6} ${cx + g.eyeDx - w / 2} ${eyeY - 2}" fill="none" stroke="#262230" stroke-width="2.6"/>`);
    parts.push(`<path d="M${cx - g.eyeDx - w / 2} ${eyeY - 3} L${cx - rx + 1} ${eyeY - 4} M${cx + g.eyeDx + w / 2} ${eyeY - 3} L${cx + rx - 1} ${eyeY - 4}" stroke="#262230" stroke-width="2.6"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs>${defs.join("")}</defs>${parts.join("")}</svg>`;
}

// The family, matched to the family photo, used as starting points
export const FAMILY_PORTRAITS: Record<string, Portrait> = {
  Joanne: { age: "adult", hair: "long-parted", hc: "2b1d14", skin: "f7d9c4", eyes: "5a3a22", glasses: false, beard: false, top: "f2f0ea" },
  Aiden: { age: "adult", hair: "swept", hc: "3b2416", skin: "f2cfb2", eyes: "7d6a3a", glasses: false, beard: true, top: "9aa0a8" },
  Millie: { age: "child", hair: "long-straight", hc: "d9b06a", skin: "fbe3d2", eyes: "6d8fae", glasses: false, beard: false, top: "f6c6d8" },
  Zara: { age: "baby", hair: "baby", hc: "b07a45", skin: "fbe3d2", eyes: "4f86b8", glasses: false, beard: false, top: "f2f0ea" },
};
