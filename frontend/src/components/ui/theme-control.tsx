"use client";

import { useEffect, useState } from "react";
import { THEME_KEY, themePreference, type ThemePreference } from "../../lib/theme";
import { Select } from "./primitives";
import styles from "../landing.module.css";

export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [blocked, setBlocked] = useState(false);
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    setPreference(themePreference(document.documentElement.dataset.theme));
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => setSystemDark(media.matches);
    syncSystem(); media.addEventListener("change", syncSystem);
    const sync = (event: StorageEvent) => { if (event.key === THEME_KEY || event.key === null) apply(themePreference(event.newValue)); };
    window.addEventListener("storage", sync); return () => { window.removeEventListener("storage", sync); media.removeEventListener("change", syncSystem); };
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
  if (compact) {
    const dark = preference === "dark" || preference === "system" && systemDark;
    return <div><button type="button" className={styles.themeToggle} aria-label="Tema oscuro" aria-pressed={dark} onClick={() => choose(dark ? "light" : "dark")}><svg aria-hidden="true" focusable="false" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{dark ? <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>}</svg></button>{blocked && <p className="hint" role="status">El tema se aplica durante esta visita; el navegador no permite guardarlo.</p>}</div>;
  }
  return <div><Select label="Tema" value={preference} onChange={event => choose(themePreference(event.target.value))}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></Select>{blocked && <p className="hint" role="status">El tema se aplica durante esta visita; el navegador no permite guardarlo.</p>}</div>;
}
