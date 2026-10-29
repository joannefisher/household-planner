// Themes for kids' lists: colours, a scattered emoji pattern, and a tray of stickers to decorate items.

export type ListTheme = {
  key: string;
  label: string;
  emoji: string;
  suggested: string; // name suggestion, e.g. "Christmas list"
  from: string; // gradient colours
  to: string;
  ink: string;
  accent: string;
  stickers: string[];
};

export const THEMES: ListTheme[] = [
  { key: "christmas", label: "Christmas", emoji: "🎄", suggested: "Christmas list", from: "#c81e3a", to: "#7a0f22", ink: "#ffffff", accent: "#ffd166", stickers: ["🎄", "🎅", "⛄", "🎁", "🦌", "⭐", "🍪", "🔔", "❄️", "🧦", "🍬", "🤶"] },
  { key: "birthday", label: "Birthday", emoji: "🎂", suggested: "Birthday wishes", from: "#ff7ab6", to: "#8b5cf6", ink: "#ffffff", accent: "#fff36b", stickers: ["🎂", "🎈", "🎉", "🎁", "🍰", "🧁", "🥳", "🦄", "🍭", "✨", "🎊", "👑"] },
  { key: "rainbow", label: "Rainbow", emoji: "🌈", suggested: "My list", from: "#ffd6e8", to: "#d7f0ff", ink: "#3b2a6b", accent: "#ff5fa2", stickers: ["🌈", "⭐", "💖", "🦋", "🌸", "✨", "🦄", "🍓", "☀️", "🌻", "💜", "🐞"] },
  { key: "space", label: "Space", emoji: "🚀", suggested: "Space mission", from: "#1c1554", to: "#3b2a8f", ink: "#ffffff", accent: "#5ce1ff", stickers: ["🚀", "🪐", "👽", "⭐", "🌙", "🛸", "☄️", "🌍", "👩‍🚀", "🔭", "🌟", "🛰️"] },
  { key: "animals", label: "Animals", emoji: "🐶", suggested: "Animal adventures", from: "#bdf0c6", to: "#8fd3a0", ink: "#1f3d26", accent: "#ff9f1c", stickers: ["🐶", "🐱", "🐰", "🦊", "🐼", "🐸", "🦁", "🐧", "🐢", "🦒", "🐨", "🐝"] },
  { key: "dinosaurs", label: "Dinosaurs", emoji: "🦖", suggested: "Dino list", from: "#2bb39a", to: "#137a68", ink: "#ffffff", accent: "#ffd166", stickers: ["🦖", "🦕", "🌋", "🥚", "🌿", "🦴", "🌴", "⭐", "🐊", "🪨", "🔥", "🐾"] },
  { key: "summer", label: "Holidays", emoji: "🏖️", suggested: "Holiday packing", from: "#ffd36b", to: "#ff8c42", ink: "#3d2300", accent: "#0aa5c2", stickers: ["🏖️", "☀️", "🍦", "🐚", "🩴", "✈️", "🧳", "🏊", "🕶️", "🌴", "🦀", "⛱️"] },
  { key: "school", label: "School", emoji: "🎒", suggested: "School things", from: "#5b8def", to: "#3d5fcc", ink: "#ffffff", accent: "#ffd166", stickers: ["🎒", "✏️", "📚", "🖍️", "📐", "🍎", "⭐", "🏅", "🎨", "🧮", "📝", "👍"] },
];

export function themeOf(key: string | null) {
  return THEMES.find((t) => t.key === key) ?? THEMES[2];
}

// A faint repeating pattern of the theme's stickers for the card background
export function patternFor(t: ListTheme) {
  const picks = t.stickers.slice(0, 4);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
    <g font-size="30" opacity="0.18">
      <text x="10" y="40">${picks[0]}</text><text x="105" y="70" transform="rotate(18 120 60)">${picks[1]}</text>
      <text x="40" y="130" transform="rotate(-14 55 120)">${picks[2]}</text><text x="125" y="165">${picks[3]}</text>
    </g></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}
