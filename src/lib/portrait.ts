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

export function portraitSvg(p: Portrait): string {
  const baby = p.age === "baby";
  const child = p.age === "child";
  const adult = !baby && !child;

  // Colours
  const skin = `#${p.skin}`;
  const skinLight = shade(p.skin, 0.22);
  const skinShadow = mix(shade(p.skin, -0.16), "#c0605a", 0.12);
  const skinDeep = mix(shade(p.skin, -0.38), "#7a3a32", 0.2);
  const hair = `#${p.hc}`;
  const hairDark = shade(p.hc, -0.4);
  const hairLight = shade(p.hc, 0.3);
  const iris = `#${p.eyes}`;
  const lip = mix(shade(p.skin, -0.3), "#c2505a", 0.55);
  const light = parseInt(p.hc.slice(0, 2), 16) > 150; // fair hair needs darker outlines

  // Head geometry
  const cx = 100;
  const cy = baby ? 102 : child ? 96 : 92;
  const rx = baby ? 47 : child ? 40 : 37;
  const ry = baby ? 46 : child ? 46 : 50;
  const T = cy - ry; // top of head
  const chin = cy + ry;
  const eyeY = baby ? cy + 8 : child ? cy + 4 : cy;
  const eyeDx = baby ? 18 : child ? 16 : 15.5;
  const eyeW = baby ? 9.5 : child ? 9 : 9;
  const eyeH = baby ? 8.4 : child ? 7.2 : 6.2;
  const irisR = baby ? 7 : child ? 5.9 : 5.3;
  const browY = eyeY - (baby ? 15 : child ? 13 : 12);
  const noseY = eyeY + (baby ? 15 : child ? 17 : 21);
  const mouthY = baby ? cy + 29 : child ? cy + 29 : cy + 33;
  const jaw = baby ? 0.95 : child ? 0.82 : 0.62; // how wide the jaw stays

  const defs: string[] = [];
  const parts: string[] = [];

  defs.push(
    `<radialGradient id="sk" cx="0.42" cy="0.38" r="0.68"><stop offset="0" stop-color="${skinLight}"/><stop offset="0.55" stop-color="${skin}"/><stop offset="1" stop-color="${skinShadow}"/></radialGradient>`,
    `<linearGradient id="hr" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${hairLight}"/><stop offset="0.35" stop-color="${hair}"/><stop offset="1" stop-color="${hairDark}"/></linearGradient>`,
    `<linearGradient id="hb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(p.hc, -0.15)}"/><stop offset="1" stop-color="${shade(p.hc, -0.45)}"/></linearGradient>`,
    `<linearGradient id="tp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(p.top, 0.12)}"/><stop offset="1" stop-color="${shade(p.top, -0.18)}"/></linearGradient>`,
    `<radialGradient id="ir" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${shade(p.eyes, 0.35)}"/><stop offset="0.7" stop-color="${iris}"/><stop offset="1" stop-color="${shade(p.eyes, -0.45)}"/></radialGradient>`,
  );

  // Face outline: wide temples, cheekbones, then a jaw that narrows to the chin
  const face =
    `M${cx} ${T} C${cx + rx * 0.62} ${T} ${cx + rx} ${cy - ry * 0.55} ${cx + rx} ${cy - ry * 0.05}` +
    ` C${cx + rx} ${cy + ry * 0.42} ${cx + rx * jaw} ${chin - ry * 0.08} ${cx} ${chin}` +
    ` C${cx - rx * jaw} ${chin - ry * 0.08} ${cx - rx} ${cy + ry * 0.42} ${cx - rx} ${cy - ry * 0.05}` +
    ` C${cx - rx} ${cy - ry * 0.55} ${cx - rx * 0.62} ${T} ${cx} ${T} Z`;

  // ---- Hair behind the head and shoulders ----
  const backHair: Partial<Record<HairStyle, string>> = {
    "long-parted": `M${cx} ${T - 8} C${cx - rx - 14} ${T - 8} ${cx - rx - 12} ${cy + 10} ${cx - rx - 12} ${cy + 40} C${cx - rx - 12} ${cy + 70} ${cx - rx - 18} ${cy + 96} ${cx - rx - 8} ${cy + 112}
      L${cx + rx + 8} ${cy + 112} C${cx + rx + 18} ${cy + 96} ${cx + rx + 12} ${cy + 70} ${cx + rx + 12} ${cy + 40} C${cx + rx + 12} ${cy + 10} ${cx + rx + 14} ${T - 8} ${cx} ${T - 8} Z`,
    "long-wavy": `M${cx} ${T - 9} C${cx - rx - 16} ${T - 9} ${cx - rx - 14} ${cy + 6} ${cx - rx - 10} ${cy + 26} C${cx - rx - 22} ${cy + 46} ${cx - rx - 6} ${cy + 62} ${cx - rx - 18} ${cy + 82} C${cx - rx - 26} ${cy + 98} ${cx - rx - 10} ${cy + 108} ${cx - rx - 4} ${cy + 112}
      L${cx + rx + 4} ${cy + 112} C${cx + rx + 10} ${cy + 108} ${cx + rx + 26} ${cy + 98} ${cx + rx + 18} ${cy + 82} C${cx + rx + 6} ${cy + 62} ${cx + rx + 22} ${cy + 46} ${cx + rx + 10} ${cy + 26} C${cx + rx + 14} ${cy + 6} ${cx + rx + 16} ${T - 9} ${cx} ${T - 9} Z`,
    "long-straight": `M${cx} ${T - 9} C${cx - rx - 14} ${T - 9} ${cx - rx - 11} ${cy} ${cx - rx - 10} ${cy + 40} L${cx - rx - 12} ${cy + 108} L${cx + rx + 12} ${cy + 108} L${cx + rx + 10} ${cy + 40} C${cx + rx + 11} ${cy} ${cx + rx + 14} ${T - 9} ${cx} ${T - 9} Z`,
    "long-fringe": `M${cx} ${T - 9} C${cx - rx - 14} ${T - 9} ${cx - rx - 11} ${cy} ${cx - rx - 10} ${cy + 40} L${cx - rx - 11} ${cy + 104} Q${cx} ${cy + 112} ${cx + rx + 11} ${cy + 104} L${cx + rx + 10} ${cy + 40} C${cx + rx + 11} ${cy} ${cx + rx + 14} ${T - 9} ${cx} ${T - 9} Z`,
    bob: `M${cx} ${T - 10} C${cx - rx - 14} ${T - 10} ${cx - rx - 12} ${cy} ${cx - rx - 10} ${cy + 36} Q${cx} ${cy + 44} ${cx + rx + 10} ${cy + 36} C${cx + rx + 12} ${cy} ${cx + rx + 14} ${T - 10} ${cx} ${T - 10} Z`,
  };
  if (backHair[p.hair]) parts.push(`<path d="${backHair[p.hair]}" fill="url(#hb)"/>`);

  // ---- Neck and shoulders ----
  const shoulderY = chin + (baby ? 8 : child ? 14 : 18);
  if (!baby) {
    const nw = child ? 12 : 14;
    parts.push(`<path d="M${cx - nw} ${chin - 22} L${cx - nw - 1} ${shoulderY + 4} Q${cx} ${shoulderY + 14} ${cx + nw + 1} ${shoulderY + 4} L${cx + nw} ${chin - 22} Z" fill="${skinShadow}"/>`);
    parts.push(`<path d="M${cx - nw} ${chin - 4} Q${cx} ${chin + 12} ${cx + nw} ${chin - 4} L${cx + nw} ${chin + 6} Q${cx} ${chin + 16} ${cx - nw} ${chin + 6} Z" fill="${skinDeep}" opacity="0.35"/>`);
  }
  const sw = baby ? 70 : child ? 70 : 82;
  parts.push(`<path d="M${cx - sw - 4} 214 C${cx - sw} ${shoulderY + 10} ${cx - sw * 0.55} ${shoulderY} ${cx - 14} ${shoulderY} L${cx + 14} ${shoulderY} C${cx + sw * 0.55} ${shoulderY} ${cx + sw} ${shoulderY + 10} ${cx + sw + 4} 214 Z" fill="url(#tp)"/>`);
  if (baby) {
    // sleepsuit collar
    parts.push(`<path d="M${cx - 22} ${shoulderY + 2} Q${cx} ${shoulderY + 20} ${cx + 22} ${shoulderY + 2}" fill="none" stroke="${shade(p.top, -0.15)}" stroke-width="3" stroke-linecap="round"/>`);
  } else {
    // crew neckline with a little skin showing
    parts.push(`<path d="M${cx - 18} ${shoulderY} Q${cx} ${shoulderY + 16} ${cx + 18} ${shoulderY} Z" fill="${skinShadow}"/>`);
    parts.push(`<path d="M${cx - 19} ${shoulderY} Q${cx} ${shoulderY + 17} ${cx + 19} ${shoulderY}" fill="none" stroke="${shade(p.top, -0.22)}" stroke-width="3.5" stroke-linecap="round"/>`);
    // a soft fold
    parts.push(`<path d="M${cx - sw * 0.62} ${shoulderY + 18} Q${cx - sw * 0.5} ${shoulderY + 30} ${cx - sw * 0.52} 214" fill="none" stroke="${shade(p.top, -0.2)}" stroke-width="2" opacity="0.5"/>`);
    parts.push(`<path d="M${cx + sw * 0.62} ${shoulderY + 18} Q${cx + sw * 0.5} ${shoulderY + 30} ${cx + sw * 0.52} 214" fill="none" stroke="${shade(p.top, -0.2)}" stroke-width="2" opacity="0.5"/>`);
  }

  // ---- Ears ----
  for (const side of [-1, 1]) {
    const ex = cx + side * (rx - 1);
    parts.push(`<ellipse cx="${ex}" cy="${eyeY + 7}" rx="${baby ? 7 : 6.5}" ry="${baby ? 9 : 11}" fill="${skinShadow}"/>`);
    parts.push(`<path d="M${ex + side * 1} ${eyeY + 1} q${side * 3} 6 0 12" fill="none" stroke="${skinDeep}" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>`);
  }

  // ---- Face ----
  parts.push(`<path d="${face}" fill="url(#sk)"/>`);
  // soft shading down the sides of the face and under the cheekbones
  parts.push(`<path d="M${cx + rx - 1} ${cy - 14} C${cx + rx} ${cy + 22} ${cx + rx * jaw + 2} ${chin - 14} ${cx + 8} ${chin - 1} C${cx + rx * jaw - 4} ${chin - 18} ${cx + rx - 8} ${cy + 18} ${cx + rx - 1} ${cy - 14} Z" fill="${skinShadow}" opacity="0.45"/>`);

  // Cheeks
  const blush = baby || child ? 0.32 : 0.18;
  for (const side of [-1, 1]) {
    parts.push(`<ellipse cx="${cx + side * (eyeDx + 6)}" cy="${eyeY + (baby ? 18 : 16)}" rx="${baby ? 10 : 8.5}" ry="${baby ? 7 : 5.5}" fill="#ff7a7a" opacity="${blush}"/>`);
  }

  // ---- Beard (sits on the skin, under the features) ----
  if (p.beard && adult) {
    defs.push(`<linearGradient id="bd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hair}" stop-opacity="0.55"/><stop offset="0.4" stop-color="${hair}" stop-opacity="0.92"/><stop offset="1" stop-color="${hairDark}"/></linearGradient>`);
    const top0 = eyeY + 12;
    parts.push(
      `<path d="M${cx - rx + 0.5} ${cy - 10} C${cx - rx + 1} ${top0 + 8} ${cx - rx + 4} ${top0 + 14} ${cx - rx + 9} ${top0 + 16}
        C${cx - 18} ${mouthY - 12} ${cx - 10} ${mouthY - 10} ${cx} ${mouthY - 10} C${cx + 10} ${mouthY - 10} ${cx + 18} ${mouthY - 12} ${cx + rx - 9} ${top0 + 16}
        C${cx + rx - 4} ${top0 + 14} ${cx + rx - 1} ${top0 + 8} ${cx + rx - 0.5} ${cy - 10}
        C${cx + rx + 1} ${cy + ry * 0.45} ${cx + rx * 0.7} ${chin + 4} ${cx} ${chin + 8} C${cx - rx * 0.7} ${chin + 4} ${cx - rx - 1} ${cy + ry * 0.45} ${cx - rx + 0.5} ${cy - 10} Z" fill="url(#bd)"/>`,
    );
    defs.push(`<clipPath id="bc"><path d="${parts[parts.length - 1].match(/d="([^"]+)"/)![1]}"/></clipPath>`);
    // hair texture
    const strokes: string[] = [];
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      const x = cx - rx + 6 + t * (rx * 2 - 12);
      const yTop = mouthY + 6 + Math.abs(t - 0.5) * -26;
      strokes.push(`M${r1(x)} ${r1(yTop)} l${r1((t - 0.5) * 3)} ${r1(8 + (1 - Math.abs(t - 0.5) * 2) * 8)}`);
    }
    parts.push(`<path clip-path="url(#bc)" d="${strokes.join(" ")}" stroke="${hairDark}" stroke-width="1.3" stroke-linecap="round" opacity="0.45"/>`);
  }

  // ---- Eyes ----
  const lash = light ? shade(p.hc, -0.65) : "#1d1512";
  for (const side of [-1, 1]) {
    const ex = cx + side * eyeDx;
    const inner = ex - side * eyeW, outer = ex + side * eyeW;
    const eye = `M${inner} ${eyeY + 0.5} Q${ex - side * 2} ${eyeY - eyeH * 1.15} ${outer} ${eyeY - 0.5} Q${ex} ${eyeY + eyeH * 0.95} ${inner} ${eyeY + 0.5} Z`;
    const clip = `e${side > 0 ? "r" : "l"}`;
    defs.push(`<clipPath id="${clip}"><path d="${eye}"/></clipPath>`);
    // eye socket shadow
    parts.push(`<ellipse cx="${ex}" cy="${eyeY - 2}" rx="${eyeW + 4}" ry="${eyeH + 4}" fill="${skinShadow}" opacity="${adult ? 0.22 : 0.1}"/>`);
    parts.push(`<path d="${eye}" fill="#fbf8f4"/>`);
    parts.push(
      `<g clip-path="url(#${clip})">` +
        `<circle cx="${ex + side * 0.5}" cy="${eyeY}" r="${irisR}" fill="url(#ir)"/>` +
        `<circle cx="${ex + side * 0.5}" cy="${eyeY}" r="${irisR * 0.45}" fill="#140e0b"/>` +
        `<path d="${eye}" fill="none" stroke="${skinDeep}" stroke-width="3" opacity="0.18"/>` +
      `</g>`,
    );
    parts.push(`<circle cx="${ex + side * 0.5 + irisR * 0.35}" cy="${eyeY - irisR * 0.35}" r="${irisR * 0.26}" fill="#ffffff"/>`);
    // upper lid line / lashes, thicker at the outer corner
    parts.push(`<path d="M${inner} ${eyeY + 0.5} Q${ex - side * 2} ${eyeY - eyeH * 1.15} ${outer} ${eyeY - 0.5}" fill="none" stroke="${lash}" stroke-width="${adult && p.beard ? 1.8 : 2.2}" stroke-linecap="round"/>`);
    if (!p.beard && !baby) parts.push(`<path d="M${outer - side * 1.5} ${eyeY - 1} l${side * 2.4} -1.8" stroke="${lash}" stroke-width="1.8" stroke-linecap="round"/>`);
    // crease above the eye
    parts.push(`<path d="M${inner + side * 1} ${eyeY - eyeH - 2} Q${ex} ${eyeY - eyeH * 2 - 2} ${outer + side * 1} ${eyeY - eyeH - 1}" fill="none" stroke="${skinDeep}" stroke-width="1.1" stroke-linecap="round" opacity="${baby ? 0 : 0.22}"/>`);
    // lower lid
    parts.push(`<path d="M${inner + side * 2} ${eyeY + eyeH * 0.9} Q${ex} ${eyeY + eyeH * 1.5} ${outer - side * 1} ${eyeY + eyeH * 0.6}" fill="none" stroke="${skinDeep}" stroke-width="1" stroke-linecap="round" opacity="0.3"/>`);

    // Eyebrows: tapered, filled shapes
    if (!baby) {
      const bIn = ex - side * (eyeW + 1), bOut = ex + side * (eyeW + 4);
      const thick = p.beard ? 4.2 : child ? 2.8 : 3.2;
      const browCol = light ? shade(p.hc, -0.3) : hairDark;
      parts.push(
        `<path d="M${bIn} ${browY + 2} Q${ex} ${browY - 4} ${bOut} ${browY + 2} Q${ex} ${browY - 4 + thick} ${bIn} ${browY + 2 + thick} Z" fill="${browCol}" opacity="${light ? 0.75 : 0.95}"/>`,
      );
    } else {
      parts.push(`<path d="M${ex - side * 7} ${browY + 2} Q${ex} ${browY - 2} ${ex + side * 8} ${browY + 2}" fill="none" stroke="${shade(p.hc, -0.1)}" stroke-width="1.6" stroke-linecap="round" opacity="0.4"/>`);
    }
  }

  // ---- Nose ----
  if (baby) {
    parts.push(`<ellipse cx="${cx}" cy="${noseY}" rx="5" ry="3.2" fill="${skinShadow}" opacity="0.7"/>`);
    parts.push(`<ellipse cx="${cx - 1}" cy="${noseY - 1.2}" rx="2" ry="1.2" fill="${skinLight}" opacity="0.8"/>`);
  } else {
    const nw = child ? 5.5 : 7;
    parts.push(`<path d="M${cx + 4} ${noseY - 12} Q${cx + 6} ${noseY - 6} ${cx + nw} ${noseY - 1}" fill="none" stroke="${skinShadow}" stroke-width="3" stroke-linecap="round" opacity="0.6"/>`);
    parts.push(`<path d="M${cx - nw} ${noseY} Q${cx - nw - 1} ${noseY + 4} ${cx - 3} ${noseY + 4} Q${cx} ${noseY + 6} ${cx + 3} ${noseY + 4} Q${cx + nw + 1} ${noseY + 4} ${cx + nw} ${noseY}" fill="none" stroke="${skinDeep}" stroke-width="1.8" stroke-linecap="round" opacity="0.65"/>`);
    parts.push(`<ellipse cx="${cx - 1}" cy="${noseY - 2}" rx="2.6" ry="2" fill="${skinLight}" opacity="0.7"/>`);
  }

  // ---- Mouth ----
  if (baby) {
    parts.push(`<path d="M${cx - 7} ${mouthY} Q${cx} ${mouthY - 3} ${cx + 7} ${mouthY} Q${cx} ${mouthY + 6} ${cx - 7} ${mouthY} Z" fill="${lip}"/>`);
    parts.push(`<path d="M${cx - 4} ${mouthY + 2} Q${cx} ${mouthY + 4} ${cx + 4} ${mouthY + 2}" stroke="${skinLight}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.6"/>`);
  } else {
    const mw = child ? 12 : p.beard ? 12 : 13.5;
    const open = child ? 5.5 : p.beard ? 3 : 5;
    const lipTop = mouthY - 2;
    // open smile with teeth
    parts.push(`<path d="M${cx - mw} ${lipTop} Q${cx} ${lipTop + 3} ${cx + mw} ${lipTop} Q${cx + mw * 0.6} ${lipTop + open + 5} ${cx} ${lipTop + open + 6} Q${cx - mw * 0.6} ${lipTop + open + 5} ${cx - mw} ${lipTop} Z" fill="#5a1f22"/>`);
    parts.push(`<path d="M${cx - mw + 2} ${lipTop + 0.8} Q${cx} ${lipTop + 3.5} ${cx + mw - 2} ${lipTop + 0.8} Q${cx + mw * 0.55} ${lipTop + open + 3} ${cx} ${lipTop + open + 3.6} Q${cx - mw * 0.55} ${lipTop + open + 3} ${cx - mw + 2} ${lipTop + 0.8} Z" fill="#fbf7f0"/>`);
    // upper lip
    parts.push(`<path d="M${cx - mw - 1} ${lipTop} Q${cx - 6} ${lipTop - 4.5} ${cx} ${lipTop - 2.5} Q${cx + 6} ${lipTop - 4.5} ${cx + mw + 1} ${lipTop} Q${cx} ${lipTop + 2.5} ${cx - mw - 1} ${lipTop} Z" fill="${lip}"/>`);
    // lower lip
    parts.push(`<path d="M${cx - mw} ${lipTop} Q${cx - mw * 0.6} ${lipTop + open + 5} ${cx} ${lipTop + open + 6} Q${cx + mw * 0.6} ${lipTop + open + 5} ${cx + mw} ${lipTop} Q${cx + mw * 0.6} ${lipTop + open + 9} ${cx} ${lipTop + open + 9.5} Q${cx - mw * 0.6} ${lipTop + open + 9} ${cx - mw} ${lipTop} Z" fill="${lip}"/>`);
    parts.push(`<ellipse cx="${cx}" cy="${lipTop + open + 7.6}" rx="${mw * 0.35}" ry="1.1" fill="#ffffff" opacity="0.3"/>`);
    // smile lines at the corners
  }

  // Moustache sits over the top lip
  if (p.beard && adult) {
    parts.push(`<path d="M${cx - 17} ${mouthY - 2} C${cx - 14} ${mouthY - 11} ${cx - 5} ${mouthY - 13} ${cx} ${mouthY - 10} C${cx + 5} ${mouthY - 13} ${cx + 14} ${mouthY - 11} ${cx + 17} ${mouthY - 2} C${cx + 10} ${mouthY - 6} ${cx + 4} ${mouthY - 6} ${cx} ${mouthY - 5} C${cx - 4} ${mouthY - 6} ${cx - 10} ${mouthY - 6} ${cx - 17} ${mouthY - 2} Z" fill="${hair}"/>`);
  }

  // ---- Hair on top of the head ----
  const strands = (d: string) => `<path d="${d}" fill="none" stroke="${hairDark}" stroke-width="1.4" stroke-linecap="round" opacity="0.35"/>`;
  const shine = (d: string) => `<path d="${d}" fill="none" stroke="${hairLight}" stroke-width="3" stroke-linecap="round" opacity="0.5"/>`;

  switch (p.hair) {
    case "long-parted": {
      // middle parting; curtains frame the face, cover the ears and fall forward over the shoulders
      for (const side of [-1, 1]) {
        const x = (d: number) => cx + side * d;
        parts.push(`<path d="M${cx} ${T - 9} C${x(22)} ${T - 9} ${x(rx + 9)} ${T + 6} ${x(rx + 9)} ${cy + 8}
          C${x(rx + 10)} ${cy + 44} ${x(rx + 14)} ${cy + 76} ${x(rx + 22)} ${cy + 104} C${x(rx + 12)} ${cy + 100} ${x(rx + 4)} ${cy + 96} ${x(rx - 2)} ${cy + 106}
          C${x(rx - 2)} ${cy + 80} ${x(rx - 4)} ${cy + 56} ${x(rx - 3)} ${cy + 30} C${x(rx - 1)} ${cy + 6} ${x(rx - 2)} ${T + 26} ${x(16)} ${T + 6} C${x(9)} ${T + 2} ${x(3)} ${T + 1} ${cx} ${T + 2} Z" fill="url(#hr)"/>`);
        parts.push(strands(`M${x(4)} ${T - 3} C${x(24)} ${T + 1} ${x(rx + 2)} ${cy - 22} ${x(rx + 3)} ${cy + 30} C${x(rx + 4)} ${cy + 60} ${x(rx + 8)} ${cy + 80} ${x(rx + 12)} ${cy + 98} M${x(rx + 6)} ${cy + 10} C${x(rx + 7)} ${cy + 50} ${x(rx + 9)} ${cy + 76} ${x(rx + 4)} ${cy + 100}`));
        parts.push(shine(`M${x(7)} ${T - 5} C${x(20)} ${T - 3} ${x(29)} ${T + 4} ${x(33)} ${T + 14}`));
      }
      break;
    }
    case "long-wavy": {
      parts.push(`<path d="M${cx - rx - 6} ${cy + 14} C${cx - rx - 12} ${T + 6} ${cx - 20} ${T - 12} ${cx + 6} ${T - 10} C${cx + rx + 8} ${T - 8} ${cx + rx + 12} ${T + 14} ${cx + rx + 6} ${cy + 14}
        C${cx + rx + 2} ${cy - 16} ${cx + rx - 6} ${T + 22} ${cx + 18} ${T + 14} C${cx} ${T + 10} ${cx - 20} ${T + 16} ${cx - rx + 4} ${cy - 8} C${cx - rx + 1} ${cy} ${cx - rx - 2} ${cy + 8} ${cx - rx - 6} ${cy + 14} Z" fill="url(#hr)"/>`);
      parts.push(strands(`M${cx + 8} ${T - 6} C${cx - 14} ${T} ${cx - rx + 2} ${T + 18} ${cx - rx - 2} ${cy + 6} M${cx + 12} ${T - 4} C${cx + 28} ${T} ${cx + rx + 2} ${T + 14} ${cx + rx + 3} ${cy + 6}`));
      parts.push(shine(`M${cx - 18} ${T - 2} Q${cx + 2} ${T - 10} ${cx + 22} ${T - 2}`));
      break;
    }
    case "long-straight": {
      // side parting, sweeping across the forehead
      parts.push(`<path d="M${cx - rx - 5} ${cy + 10} C${cx - rx - 8} ${T} ${cx - 14} ${T - 11} ${cx + 4} ${T - 10} C${cx + rx + 6} ${T - 10} ${cx + rx + 8} ${T + 10} ${cx + rx + 5} ${cy + 10}
        C${cx + rx} ${cy - 18} ${cx + rx - 6} ${T + 26} ${cx + 12} ${T + 22} C${cx - 4} ${T + 18} ${cx - 16} ${T + 6} ${cx - 14} ${T + 4} C${cx - 26} ${T + 14} ${cx - rx + 2} ${cy - 18} ${cx - rx - 5} ${cy + 10} Z" fill="url(#hr)"/>`);
      parts.push(strands(`M${cx - 14} ${T - 6} C${cx + 6} ${T} ${cx + rx - 4} ${T + 10} ${cx + rx + 2} ${cy} M${cx - 14} ${T - 6} C${cx - 26} ${T} ${cx - rx} ${T + 18} ${cx - rx - 2} ${cy}`));
      parts.push(shine(`M${cx - 4} ${T - 4} Q${cx + 16} ${T - 4} ${cx + 28} ${T + 6}`));
      break;
    }
    case "long-fringe": {
      parts.push(`<path d="M${cx - rx - 5} ${cy + 8} C${cx - rx - 8} ${T} ${cx - 14} ${T - 11} ${cx} ${T - 10} C${cx + 14} ${T - 11} ${cx + rx + 8} ${T} ${cx + rx + 5} ${cy + 8}
        L${cx + rx - 2} ${browY - 2} Q${cx + 20} ${browY + 2} ${cx + 10} ${browY - 1} Q${cx} ${browY + 3} ${cx - 10} ${browY - 1} Q${cx - 20} ${browY + 2} ${cx - rx + 2} ${browY - 2} Z" fill="url(#hr)"/>`);
      parts.push(strands(`M${cx - 20} ${T + 6} L${cx - 22} ${browY - 2} M${cx - 6} ${T + 4} L${cx - 6} ${browY} M${cx + 8} ${T + 4} L${cx + 8} ${browY} M${cx + 22} ${T + 6} L${cx + 24} ${browY - 2}`));
      parts.push(shine(`M${cx - 18} ${T + 2} Q${cx} ${T - 6} ${cx + 18} ${T + 2}`));
      break;
    }
    case "bob": {
      parts.push(`<path d="M${cx - rx - 6} ${cy + 26} C${cx - rx - 10} ${T} ${cx - 14} ${T - 11} ${cx} ${T - 10} C${cx + 14} ${T - 11} ${cx + rx + 10} ${T} ${cx + rx + 6} ${cy + 26}
        L${cx + rx - 2} ${cy + 22} C${cx + rx} ${cy - 10} ${cx + rx - 6} ${T + 22} ${cx + 8} ${T + 16} C${cx - 14} ${T + 20} ${cx - rx + 4} ${cy - 14} ${cx - rx + 2} ${cy + 22} Z" fill="url(#hr)"/>`);
      parts.push(shine(`M${cx - 18} ${T - 2} Q${cx + 2} ${T - 10} ${cx + 22} ${T - 2}`));
      break;
    }
    case "swept": {
      // short sides, a little height on top, swept up and back with a slightly higher hairline
      const hl = T + 13;
      parts.push(`<path d="M${cx - rx + 1} ${cy - 2} C${cx - rx - 3} ${T + 4} ${cx - rx + 6} ${T - 12} ${cx - 6} ${T - 14} C${cx + 16} ${T - 18} ${cx + rx + 4} ${T - 6} ${cx + rx - 1} ${cy - 2}
        C${cx + rx - 4} ${hl + 6} ${cx + rx - 12} ${hl - 4} ${cx + 22} ${hl - 2} C${cx + 12} ${hl + 2} ${cx + 4} ${hl + 2} ${cx - 6} ${hl} C${cx - 16} ${hl - 1} ${cx - 24} ${hl - 3} ${cx - rx + 10} ${hl + 2} C${cx - rx + 5} ${hl + 8} ${cx - rx + 4} ${cy - 10} ${cx - rx + 1} ${cy - 2} Z" fill="url(#hr)"/>`);
      parts.push(strands(`M${cx - 20} ${hl - 1} Q${cx - 18} ${T - 2} ${cx - 2} ${T - 10} M${cx - 6} ${hl} Q${cx - 2} ${T - 2} ${cx + 10} ${T - 8} M${cx + 10} ${hl} Q${cx + 14} ${T + 2} ${cx + 22} ${T - 4}`));
      parts.push(shine(`M${cx - 12} ${T - 8} Q${cx + 4} ${T - 15} ${cx + 20} ${T - 10}`));
      // sideburns fade into the beard
      for (const side of [-1, 1]) {
        const x = (d: number) => cx + side * d;
        parts.push(`<path d="M${x(rx - 0.5)} ${cy - 16} C${x(rx - 4)} ${cy - 16} ${x(rx - 6)} ${cy - 12} ${x(rx - 5.5)} ${cy - 4} L${x(rx - 4)} ${eyeY + (p.beard ? 18 : 8)} L${x(rx - 0.5)} ${eyeY + (p.beard ? 20 : 10)} Z" fill="${hair}" opacity="0.9"/>`);
      }
      break;
    }
    case "short": {
      parts.push(`<path d="M${cx - rx + 1} ${cy - 4} C${cx - rx - 3} ${T} ${cx - 14} ${T - 12} ${cx + 2} ${T - 12} C${cx + 20} ${T - 12} ${cx + rx + 4} ${T} ${cx + rx - 1} ${cy - 4}
        C${cx + rx - 6} ${T + 16} ${cx + 18} ${T + 10} ${cx + 4} ${T + 13} C${cx - 10} ${T + 16} ${cx - 20} ${T + 12} ${cx - rx + 8} ${T + 22} C${cx - rx + 3} ${cy - 16} ${cx - rx + 2} ${cy - 8} ${cx - rx + 1} ${cy - 4} Z" fill="url(#hr)"/>`);
      parts.push(strands(`M${cx - 18} ${T + 10} Q${cx - 10} ${T - 4} ${cx + 8} ${T - 8} M${cx} ${T + 11} Q${cx + 10} ${T} ${cx + 24} ${T - 2}`));
      parts.push(`<path d="M${cx - rx + 0.5} ${cy - 12} L${cx - rx + 7} ${cy - 14} L${cx - rx + 7} ${eyeY + (p.beard ? 18 : 6)} L${cx - rx + 1} ${eyeY + (p.beard ? 22 : 8)} Z" fill="${hair}"/>`);
      parts.push(`<path d="M${cx + rx - 0.5} ${cy - 12} L${cx + rx - 7} ${cy - 14} L${cx + rx - 7} ${eyeY + (p.beard ? 18 : 6)} L${cx + rx - 1} ${eyeY + (p.beard ? 22 : 8)} Z" fill="${hair}"/>`);
      break;
    }
    case "curly": {
      const curls = Array.from({ length: 11 }, (_, i) => {
        const a = Math.PI * (1.0 + (i / 10) * 1.0);
        const x = cx + Math.cos(a) * (rx - 2);
        const y = cy - 8 + Math.sin(a) * (ry + 2);
        return `<circle cx="${r1(x)}" cy="${r1(y)}" r="12" fill="url(#hr)"/><path d="M${r1(x - 5)} ${r1(y + 2)} q5 -8 10 0" fill="none" stroke="${hairDark}" stroke-width="1.4" opacity="0.4"/>`;
      });
      parts.push(curls.join(""));
      break;
    }
    case "baby": {
      // sparse, soft wisps with a little curl on top
      defs.push(`<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>`);
      parts.push(`<path filter="url(#soft)" d="M${cx - rx + 8} ${cy - 18} C${cx - rx + 4} ${T + 4} ${cx - 16} ${T - 4} ${cx} ${T - 4} C${cx + 16} ${T - 4} ${cx + rx - 4} ${T + 4} ${cx + rx - 8} ${cy - 18}
        C${cx + 26} ${T + 12} ${cx + 10} ${T + 10} ${cx} ${T + 12} C${cx - 10} ${T + 10} ${cx - 26} ${T + 12} ${cx - rx + 8} ${cy - 18} Z" fill="${hair}" opacity="0.5"/>`);
      parts.push(`<path d="M${cx - 2} ${T - 2} q-4 -12 7 -12 q7 2 2 8 q-1 -4 -5 -2" fill="none" stroke="${hair}" stroke-width="2.6" stroke-linecap="round" opacity="0.8"/>`);
      parts.push(`<path d="M${cx - 22} ${T + 4} q4 -6 10 -7 M${cx + 10} ${T - 2} q8 0 12 6" fill="none" stroke="${hair}" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>`);
      break;
    }
    case "bald":
      break;
  }

  // ---- Glasses on top ----
  if (p.glasses) {
    const w = eyeW * 2 + 9, h = eyeH * 2 + 12;
    for (const side of [-1, 1]) {
      const ex = cx + side * eyeDx;
      parts.push(`<rect x="${ex - w / 2}" y="${eyeY - h / 2}" width="${w}" height="${h}" rx="7" fill="#ffffff" fill-opacity="0.12" stroke="#2a2430" stroke-width="2.6"/>`);
    }
    parts.push(`<path d="M${cx - eyeDx + w / 2} ${eyeY - 2} Q${cx} ${eyeY - 6} ${cx + eyeDx - w / 2} ${eyeY - 2}" fill="none" stroke="#2a2430" stroke-width="2.6"/>`);
    parts.push(`<path d="M${cx - eyeDx - w / 2} ${eyeY - 3} L${cx - rx + 1} ${eyeY - 4} M${cx + eyeDx + w / 2} ${eyeY - 3} L${cx + rx - 1} ${eyeY - 4}" stroke="#2a2430" stroke-width="2.6"/>`);
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
