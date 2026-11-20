import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeControl } from "../ui/theme-control";
import styles from "./shells.module.css";
export function PublicShell({ children, health }: { children: ReactNode; health?: string }) {
  return <div className={styles.publicShell}><header className={styles.publicHeader}><Link href="/" className="brand">SIARE<span className="brand-caption">Tu espacio de aprendizaje</span></Link><div className="actions"><ThemeControl /><Link href="/login" className="button secondary">Iniciar sesión</Link></div></header><main id="contenido" tabIndex={-1}>{children}</main><footer className={styles.publicFooter}><span>SIARE Académico</span>{health && <span role="status">{health}</span>}</footer></div>;
}
