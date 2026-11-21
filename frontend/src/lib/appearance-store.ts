"use client";

import { useSyncExternalStore } from "react";
import { APPEARANCE_KEY, DEFAULT_APPEARANCE, normalizeAppearance, applyAppearance, type Appearance } from "./appearance";
import { THEME_KEY, themePreference, type ThemePreference } from "./theme";

const initial = { appearance: DEFAULT_APPEARANCE, theme: "system" as ThemePreference, systemDark: false, blocked: false };
let snapshot = initial;
const listeners = new Set<() => void>();
let initialized = false;
function emit() { listeners.forEach(listener => listener()); }
function applyTheme(theme: ThemePreference) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", theme === "system" ? "light dark" : theme);
}
function initialize() {
  if (initialized) return;
  initialized = true;
  const media = matchMedia("(prefers-color-scheme: dark)");
  let appearance = DEFAULT_APPEARANCE, theme: ThemePreference = themePreference(document.documentElement.dataset.theme), blocked = false;
  try { appearance = normalizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY) || "null")); } catch { /* Invalid JSON returns approved defaults. */ }
  try { theme = themePreference(localStorage.getItem(THEME_KEY)); } catch { blocked = true; }
  snapshot = { appearance, theme, systemDark: media.matches, blocked };
  applyAppearance(appearance); applyTheme(theme);
  media.addEventListener("change", () => { snapshot = { ...snapshot, systemDark: media.matches }; emit(); });
  window.addEventListener("storage", event => {
    // Synthetic events and blocked storage must never throw during synchronization.
    try { if (event.storageArea && event.storageArea !== localStorage) return; } catch { return; }
    if (event.key === THEME_KEY || event.key === null) {
      const theme = themePreference(event.key === null ? null : event.newValue);
      applyTheme(theme); snapshot = { ...snapshot, theme };
    }
    if (event.key === APPEARANCE_KEY || event.key === null) {
      let appearance = DEFAULT_APPEARANCE;
      try { appearance = normalizeAppearance(JSON.parse(event.newValue || "null")); } catch {}
      applyAppearance(appearance); snapshot = { ...snapshot, appearance };
    }
    emit();
  });
}
function subscribe(listener: () => void) { initialize(); listeners.add(listener); return () => { listeners.delete(listener); }; }
export function useAppearance() { return useSyncExternalStore(subscribe, () => snapshot, () => initial); }

export function setAppearance(patch: Partial<Appearance>) {
  initialize();
  const appearance = normalizeAppearance({ ...snapshot.appearance, ...patch });
  applyAppearance(appearance); snapshot = { ...snapshot, appearance };
  try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance)); } catch { snapshot = { ...snapshot, blocked: true }; }
  emit();
}
export function setTheme(theme: ThemePreference) {
  initialize(); applyTheme(theme); snapshot = { ...snapshot, theme };
  try { if (theme === "system") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, theme); }
  catch { snapshot = { ...snapshot, blocked: true }; }
  emit();
}
export function resetAppearance() {
  // Navigation density is independent of restoring the five appearance choices.
  setAppearance({ ...DEFAULT_APPEARANCE, expanded: snapshot.appearance.expanded });
  setTheme("system");
}
