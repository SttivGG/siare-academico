"use client";

import { themePreference } from "../../lib/theme";
import { useAppearance, setTheme } from "../../lib/appearance-store";
import { Select } from "./primitives";
import styles from "./theme-control.module.css";

export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const { theme: preference, systemDark } = useAppearance();
  const choose = setTheme;
  if (compact) {
    const dark = preference === "dark" || preference === "system" && systemDark;
    return <div><button type="button" className={styles.themeToggle} aria-label="Tema oscuro" title={dark ? "Tema oscuro · Activar tema claro" : "Tema claro · Activar tema oscuro"} aria-pressed={dark} onClick={() => choose(dark ? "light" : "dark")}><svg aria-hidden="true" focusable="false" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{dark ? <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>}</svg></button></div>;
  }
  return <div><Select label="Tema" value={preference} onChange={event => choose(themePreference(event.target.value))}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></Select></div>;
}
