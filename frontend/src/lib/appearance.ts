export const APPEARANCE_KEY = "siare-appearance-v1";
export const BACKGROUNDS = [
  { id: "education", label: "Fondo educativo actual", image: "/images/study-background.webp", thumbnail: "/images/backgrounds/education-thumb.webp" },
  { id: "library", label: "Biblioteca moderna", image: "/images/backgrounds/library.webp", thumbnail: "/images/backgrounds/library-thumb.webp" },
  { id: "minimal", label: "Espacio de estudio minimalista", image: "/images/backgrounds/minimal.webp", thumbnail: "/images/backgrounds/minimal-thumb.webp" },
  { id: "collaborative", label: "Aprendizaje colaborativo", image: "/images/backgrounds/collaborative.webp", thumbnail: "/images/backgrounds/collaborative-thumb.webp" },
  { id: "reading", label: "Sala de lectura contemporánea", image: "/images/backgrounds/reading.webp", thumbnail: "/images/backgrounds/reading-thumb.webp" },
  { id: "none", label: "Sin imagen", image: "", thumbnail: "" },
] as const;
export type Appearance = { version: 1; background: typeof BACKGROUNDS[number]["id"]; transparency: number; blur: number; veil: number; expanded: boolean };
export const DEFAULT_APPEARANCE: Appearance = { version: 1, background: "education", transparency: 72, blur: 10, veil: 50, expanded: false };

// Self-contained factory: serializing it remains safe after production minification.
// No free variables or user strings are interpolated into the pre-paint script.
export function appearanceRuntime(backgrounds: readonly { id: string }[], defaults: Appearance) {
function normalize(value: unknown): Appearance {
  const p = value && typeof value === "object" ? value as Partial<Appearance> : {};
  if (p.version !== 1) return { ...defaults };
  const number = (v: unknown, min: number, max: number, fallback: number) => typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback;
  return { version: 1, background: backgrounds.some(b => b.id === p.background) ? p.background! : "education", transparency: number(p.transparency, 20, 72, 72), blur: number(p.blur, 0, 24, 10), veil: number(p.veil, 0, 100, 50), expanded: p.expanded === true };
}

// Both the pre-paint bootstrap and the live store use this exact validated mapping.
// Set inputs, not semantic surface tokens: accessibility media rules must win.
function apply(p: Appearance) {
  const root = document.documentElement;
  root.dataset.background = p.background;
  root.dataset.rail = p.expanded ? "expanded" : "collapsed";
  root.style.setProperty("--appearance-opacity", String((100 - p.transparency) / 100));
  root.style.setProperty("--appearance-blur", `${p.blur}px`);
  root.style.setProperty("--appearance-navigation-blur", `${Math.min(24, p.blur * 1.2)}px`);
  root.style.setProperty("--appearance-veil", String((p.veil - 50) / 100));
}
return { normalize, apply };
}
export const { normalize: normalizeAppearance, apply: applyAppearance } = appearanceRuntime(BACKGROUNDS, DEFAULT_APPEARANCE);

export const appearanceBootstrap = `;(()=>{const defaults=${JSON.stringify(DEFAULT_APPEARANCE)},runtime=(${appearanceRuntime.toString()})(${JSON.stringify(BACKGROUNDS.map(({ id }) => ({ id })))},defaults);let p=defaults;try{p=runtime.normalize(JSON.parse(localStorage.getItem('${APPEARANCE_KEY}')||'null'))}catch{}runtime.apply(p)})()`;
