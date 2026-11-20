export type ThemePreference = "system" | "light" | "dark";
export const THEME_KEY = "siare-theme";
export function themePreference(value: unknown): ThemePreference { return value === "light" || value === "dark" ? value : "system"; }
// Only the visual enum is read here. Runs before paint; storage failure is harmless.
export const themeBootstrap = `try{var t=localStorage.getItem('siare-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;document.querySelector('meta[name="color-scheme"]').content=t}}catch{}`;
