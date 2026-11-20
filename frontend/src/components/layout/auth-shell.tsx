import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeControl } from "../ui/theme-control";
import styles from "./shells.module.css";

export function AuthShell({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return <div className={styles.authShell}><aside className={styles.authAside}><Link href="/" className="brand"><span className={styles.wordmark}>SIARE<span className={styles.mark} aria-hidden="true">S</span></span><span className="brand-caption">Tu espacio de aprendizaje</span></Link><div><span className="eyebrow">Un paso más en tu aprendizaje</span><h2>Tu espacio.<br />Tu ritmo.</h2><p className="muted">Reúne tus fuentes, organiza tus materias y practica con actividades revisadas.</p><div className={styles.notebook} aria-hidden="true"><span>Fuentes</span><strong>Comprende.<br />Practica.<br />Conecta.</strong><span>Tu cuaderno de estudio</span></div></div><p className="hint">Sistema Inteligente de Aprendizaje y Refuerzo Educativo</p></aside>
    <main id="contenido" tabIndex={-1} className={styles.authMain}><div className={styles.authTools}><Link className="back-link" href="/">← Volver al inicio</Link><ThemeControl /></div><div className={styles.authCard}><span className="eyebrow">SIARE Académico</span><h1>{title}</h1>{intro && <p className="muted section-intro">{intro}</p>}{children}</div><footer className="hint">Un espacio para aprender, a tu ritmo.</footer></main></div>;
}
