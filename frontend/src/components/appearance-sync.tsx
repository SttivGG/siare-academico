"use client";
import { useAppearance } from "../lib/appearance-store";

// Subscribe once at the root, including public, error and authentication screens.
// No keyed wrapper or context surrounds academic children.
export function AppearanceSync() {
  const { blocked } = useAppearance();
  return blocked ? <p role="status" className="appearance-notice">El navegador no permite guardar la apariencia. Los cambios se conservan durante esta visita.</p> : null;
}
