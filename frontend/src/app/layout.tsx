import type { Metadata } from "next";
import "./globals.css";
import { themeBootstrap } from "../lib/theme";
import { appearanceBootstrap } from "../lib/appearance";
import { AppearanceSync } from "../components/appearance-sync";

export const metadata: Metadata = {
  title: { default: "SIARE · Tu espacio de aprendizaje", template: "%s · SIARE" },
  description: "Organiza tus materias y construye tu espacio de aprendizaje.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" suppressHydrationWarning><head><meta name="color-scheme" content="light dark" /><script dangerouslySetInnerHTML={{ __html: themeBootstrap + appearanceBootstrap }} /></head><body><AppearanceSync /><a className="skip-link" href="#contenido">Saltar al contenido</a>{children}</body></html>;
}
