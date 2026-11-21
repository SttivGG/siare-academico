import type { ReactNode } from "react";
import { ThemeControl } from "../ui/theme-control";
import { Surface } from "../ui/primitives";
export function FeedbackShell({ title, code, children }: { title: string; code?: string; children: ReactNode }) {
  return <main id="contenido" tabIndex={-1} className="error-page"><ThemeControl /><Surface><span className="eyebrow">SIARE{code ? ` · ${code}` : ""}</span><h1>{title}</h1>{children}</Surface></main>;
}
