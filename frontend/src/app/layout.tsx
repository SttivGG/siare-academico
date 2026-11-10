import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SIARE · Tu espacio de aprendizaje", template: "%s · SIARE" },
  description: "Organiza tus materias y construye tu espacio de aprendizaje.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><a className="skip-link" href="#contenido">Saltar al contenido</a>{children}</body></html>;
}
