// Original animal avatars, drawn as simple SVG. Stored on a member as "a:<name>".

const eye = (x: number, y: number, r = 9) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#1d1820"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.32}" fill="#fff"/>`;
const blush = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="9" fill="#ff8a9a" opacity="0.45"/>`;
const smile = (y: number, w = 12) => `<path d="M${100 - w} ${y} Q100 ${y + w * 0.9} ${100 + w} ${y}" fill="none" stroke="#1d1820" stroke-width="4" stroke-linecap="round"/>`;

const DRAW: Record<string, () => string> = {
  fox: () => `
    <path d="M44 52 L70 96 L40 104 Z M156 52 L130 96 L160 104 Z" fill="#e8742c"/>
    <path d="M52 66 L66 94 L50 98 Z M148 66 L134 94 L150 98 Z" fill="#3b2418"/>
    <path d="M100 172 Q44 160 40 104 Q60 80 100 80 Q140 80 160 104 Q156 160 100 172 Z" fill="#f08a3c"/>
    <path d="M100 172 Q62 164 52 124 Q78 122 100 146 Q122 122 148 124 Q138 164 100 172 Z" fill="#fff4e6"/>
    ${eye(78, 112)}${eye(122, 112)}
    <ellipse cx="100" cy="146" rx="9" ry="7" fill="#1d1820"/>${blush(64, 132)}${blush(136, 132)}`,
  cat: () => `
    <path d="M46 46 L80 84 L42 98 Z M154 46 L120 84 L158 98 Z" fill="#8c8fa3"/>
    <path d="M54 60 L74 84 L52 92 Z M146 60 L126 84 L148 92 Z" fill="#f5b5c4"/>
    <ellipse cx="100" cy="120" rx="62" ry="54" fill="#a3a6ba"/>
    <path d="M86 70 Q100 62 114 70 L108 90 Q100 86 92 90 Z" fill="#8c8fa3"/>
    ${eye(78, 116, 10)}${eye(122, 116, 10)}
    <path d="M94 136 L106 136 L100 143 Z" fill="#f08aa0"/>
    <path d="M100 143 Q92 152 84 146 M100 143 Q108 152 116 146" fill="none" stroke="#1d1820" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M44 134 L74 138 M44 148 L74 144 M156 134 L126 138 M156 148 L126 144" stroke="#5d6074" stroke-width="3" stroke-linecap="round"/>`,
  bear: () => `
    <circle cx="54" cy="68" r="24" fill="#8a5a3b"/><circle cx="146" cy="68" r="24" fill="#8a5a3b"/>
    <circle cx="54" cy="68" r="12" fill="#c99872"/><circle cx="146" cy="68" r="12" fill="#c99872"/>
    <circle cx="100" cy="116" r="62" fill="#9c6a47"/>
    <ellipse cx="100" cy="142" rx="30" ry="24" fill="#e2bf9c"/>
    ${eye(76, 108)}${eye(124, 108)}
    <ellipse cx="100" cy="132" rx="11" ry="8" fill="#2b1d16"/>${smile(146, 9)}${blush(62, 130)}${blush(138, 130)}`,
  panda: () => `
    <circle cx="52" cy="66" r="24" fill="#26222b"/><circle cx="148" cy="66" r="24" fill="#26222b"/>
    <circle cx="100" cy="116" r="64" fill="#ffffff"/>
    <ellipse cx="74" cy="110" rx="17" ry="22" transform="rotate(-25 74 110)" fill="#26222b"/>
    <ellipse cx="126" cy="110" rx="17" ry="22" transform="rotate(25 126 110)" fill="#26222b"/>
    <circle cx="76" cy="108" r="6" fill="#fff"/><circle cx="124" cy="108" r="6" fill="#fff"/>
    <ellipse cx="100" cy="134" rx="10" ry="7" fill="#26222b"/>${smile(146, 9)}${blush(60, 136)}${blush(140, 136)}`,
  bunny: () => `
    <ellipse cx="74" cy="48" rx="16" ry="44" fill="#f4f1f6"/><ellipse cx="126" cy="48" rx="16" ry="44" fill="#f4f1f6"/>
    <ellipse cx="74" cy="50" rx="8" ry="32" fill="#f7b6c8"/><ellipse cx="126" cy="50" rx="8" ry="32" fill="#f7b6c8"/>
    <ellipse cx="100" cy="128" rx="60" ry="54" fill="#f4f1f6"/>
    ${eye(78, 122)}${eye(122, 122)}
    <path d="M93 140 L107 140 L100 148 Z" fill="#f08aa0"/>
    <path d="M100 148 L100 156 M100 156 Q92 162 86 156 M100 156 Q108 162 114 156" fill="none" stroke="#1d1820" stroke-width="3.5" stroke-linecap="round"/>
    ${blush(62, 144)}${blush(138, 144)}`,
  owl: () => `
    <path d="M48 70 L66 92 L48 100 Z M152 70 L134 92 L152 100 Z" fill="#6e4a33"/>
    <ellipse cx="100" cy="124" rx="60" ry="58" fill="#8b5e40"/>
    <ellipse cx="100" cy="146" rx="36" ry="30" fill="#e8c9a3"/>
    <circle cx="76" cy="108" r="22" fill="#fff6e6"/><circle cx="124" cy="108" r="22" fill="#fff6e6"/>
    ${eye(76, 108, 11)}${eye(124, 108, 11)}
    <path d="M92 126 L108 126 L100 140 Z" fill="#f2a632"/>
    <path d="M84 156 Q90 150 96 156 M104 156 Q110 150 116 156 M94 168 Q100 162 106 168" fill="none" stroke="#b98a62" stroke-width="3" stroke-linecap="round"/>`,
  frog: () => `
    <circle cx="66" cy="74" r="26" fill="#4cb860"/><circle cx="134" cy="74" r="26" fill="#4cb860"/>
    <circle cx="66" cy="74" r="16" fill="#fff"/><circle cx="134" cy="74" r="16" fill="#fff"/>
    ${eye(68, 76, 9)}${eye(132, 76, 9)}
    <ellipse cx="100" cy="132" rx="70" ry="48" fill="#5ccc70"/>
    <path d="M58 136 Q100 172 142 136" fill="none" stroke="#1d1820" stroke-width="4.5" stroke-linecap="round"/>
    <circle cx="90" cy="118" r="3" fill="#2f7a3c"/><circle cx="110" cy="118" r="3" fill="#2f7a3c"/>${blush(50, 140)}${blush(150, 140)}`,
  lion: () => `
    ${Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return `<circle cx="${100 + Math.cos(a) * 58}" cy="${112 + Math.sin(a) * 58}" r="28" fill="${i % 2 ? "#c2662a" : "#d97a34"}"/>`;
    }).join("")}
    <circle cx="100" cy="112" r="56" fill="#f6c453"/>
    <circle cx="62" cy="74" r="12" fill="#f6c453"/><circle cx="138" cy="74" r="12" fill="#f6c453"/>
    ${eye(80, 106)}${eye(120, 106)}
    <ellipse cx="100" cy="138" rx="26" ry="18" fill="#fde6a6"/>
    <path d="M92 128 L108 128 L100 137 Z" fill="#7a3f1f"/>
    <path d="M100 137 Q92 148 84 142 M100 137 Q108 148 116 142" fill="none" stroke="#1d1820" stroke-width="3.5" stroke-linecap="round"/>`,
  unicorn: () => `
    <path d="M100 18 L110 70 L90 70 Z" fill="#f6c453"/>
    <path d="M94 34 L106 40 M92 48 L108 54 M91 60 L109 66" stroke="#e2a520" stroke-width="3"/>
    <path d="M56 58 L74 92 L50 98 Z M144 58 L126 92 L150 98 Z" fill="#fbf6ff"/>
    <ellipse cx="100" cy="124" rx="58" ry="56" fill="#fbf6ff"/>
    <path d="M44 106 Q40 64 92 66 Q70 84 72 112 Q56 104 44 106 Z" fill="#c38bff"/>
    <path d="M60 84 Q70 66 104 68 Q86 80 84 98 Z" fill="#ff8ac4"/>
    ${eye(80, 120)}${eye(124, 120)}
    <ellipse cx="100" cy="150" rx="28" ry="20" fill="#f7d9ee"/>
    <circle cx="92" cy="148" r="3" fill="#b37aa0"/><circle cx="108" cy="148" r="3" fill="#b37aa0"/>${blush(62, 140)}${blush(140, 140)}`,
  dino: () => `
    <path d="M58 70 L66 52 L76 68 L86 46 L96 64 L106 44 L114 64 L126 50 L132 70 Z" fill="#2f9e8f"/>
    <ellipse cx="100" cy="122" rx="64" ry="56" fill="#46c2b0"/>
    <ellipse cx="100" cy="150" rx="44" ry="24" fill="#7fe0cf"/>
    ${eye(76, 110)}${eye(124, 110)}
    <circle cx="88" cy="140" r="3.5" fill="#2a7166"/><circle cx="112" cy="140" r="3.5" fill="#2a7166"/>
    <path d="M78 154 Q100 170 122 154" fill="none" stroke="#1d1820" stroke-width="4" stroke-linecap="round"/>
    <path d="M90 158 L94 164 L98 159 M104 159 L108 164 L112 158" fill="#fff" stroke="#fff" stroke-width="2"/>`,
  robot: () => `
    <path d="M100 38 L100 58" stroke="#7a8296" stroke-width="5"/><circle cx="100" cy="34" r="9" fill="#ff5a6e"/>
    <rect x="44" y="58" width="112" height="104" rx="26" fill="#b8c2d6"/>
    <rect x="30" y="92" width="16" height="34" rx="6" fill="#8e98ad"/><rect x="154" y="92" width="16" height="34" rx="6" fill="#8e98ad"/>
    <rect x="58" y="80" width="84" height="50" rx="16" fill="#26314a"/>
    <circle cx="80" cy="104" r="11" fill="#5ce1ff"/><circle cx="120" cy="104" r="11" fill="#5ce1ff"/>
    <circle cx="84" cy="100" r="3.5" fill="#fff"/><circle cx="124" cy="100" r="3.5" fill="#fff"/>
    <rect x="76" y="140" width="48" height="10" rx="5" fill="#26314a"/>
    <path d="M86 140 L86 150 M96 140 L96 150 M106 140 L106 150 M116 140 L116 150" stroke="#5ce1ff" stroke-width="2.5"/>`,
  penguin: () => `
    <ellipse cx="100" cy="116" rx="62" ry="62" fill="#26283a"/>
    <path d="M100 76 Q54 76 52 120 Q54 168 100 172 Q146 168 148 120 Q146 76 100 76 Z" fill="#ffffff"/>
    <path d="M100 76 Q86 96 100 110 Q114 96 100 76 Z" fill="#26283a"/>
    ${eye(80, 112)}${eye(120, 112)}
    <path d="M88 130 Q100 124 112 130 Q100 146 88 130 Z" fill="#f6a43a"/>${blush(64, 138)}${blush(136, 138)}`,
};

export const ANIMALS = Object.keys(DRAW);

export const ANIMAL_BG: Record<string, string> = {
  fox: "#ffe0c7", cat: "#e3e6f3", bear: "#f1dccb", panda: "#dff3e4", bunny: "#ffe1ec", owl: "#f3e6d6",
  frog: "#dcf5d9", lion: "#fff0c9", unicorn: "#efe2ff", dino: "#d8f4ef", robot: "#e4ecf8", penguin: "#dcecff",
};

export function animalSvg(name: string) {
  const draw = DRAW[name] ?? DRAW.fox;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${draw()}</svg>`;
}
