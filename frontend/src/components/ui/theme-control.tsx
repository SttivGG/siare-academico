"use client";

import { useEffect, useState } from "react";
import { THEME_KEY, themePreference, type ThemePreference } from "../../lib/theme";
import { Select } from "./primitives";

export function ThemeControl() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    setPreference(themePreference(document.documentElement.dataset.theme));
    const sync = (event: StorageEvent) => { if (event.key === THEME_KEY || event.key === null) apply(themePreference(event.newValue)); };
    window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync);
  }, []);
  function apply(value: ThemePreference) {
    if (value === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = value;
    document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", value === "system" ? "light dark" : value);
    setPreference(value);
  }
  function choose(value: ThemePreference) {
    apply(value);
    try { if (value === "system") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, value); setBlocked(false); }
    catch { setBlocked(true); }
  }
  return <div><Select label="Tema" value={preference} onChange={event => choose(themePreference(event.target.value))}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></Select>{blocked && <p className="hint" role="status">El tema se aplica durante esta visita; el navegador no permite guardarlo.</p>}</div>;
}
