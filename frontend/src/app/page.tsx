import Image from "next/image";
import logo from "../../public/images/siare-logo.png";
import { LandingAccess } from "../components/landing-access";
import { ThemeControl } from "../components/ui/theme-control";
import { getCoreHealth } from "../lib/server-health";
import { Icon } from "../components/ui/icon";
import styles from "../components/landing.module.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const health = await getCoreHealth();
  const ready = health.status === "UP";
  return <div className={styles.landing}>
    <header className={styles.header}><ThemeControl compact /></header>
    <main id="contenido" tabIndex={-1} className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.identity}><div className={styles.logoArtwork}><Image src={logo} alt="SIARE" preload sizes="(max-width: 540px) 330px, (max-width: 800px) 390px, (max-width: 1100px) 420px, (max-width: 1632px) 510px, 540px" /></div><span>Académico</span></div>
        <div className={styles.accessColumn}>
          <div className={styles.welcome}>
            <span className="eyebrow">Tu espacio de aprendizaje</span>
            <h1>Un lugar para empezar.<br /><span>Una materia a la vez.</span></h1>
            <p className="lead muted">Organiza tus materias, conecta tus fuentes y encuentra tu propia forma de aprender.</p>
          </div>
          <LandingAccess />
        </div>
      </section>
      <ol className={styles.steps} role="list">
        <li><span className={styles.stepIcon}><Icon name="book" /></span><div><h2>Organiza</h2><p>Crea materias y conserva sus fuentes en un solo espacio.</p></div></li>
        <li><span className={styles.stepIcon}><Icon name="file" /></span><div><h2>Comprende</h2><p>Consulta tus documentos y revisa el material de estudio.</p></div></li>
        <li><span className={styles.stepIcon}><Icon name="study" /></span><div><h2>Practica</h2><p>Prepara bancos revisados y responde Quiz y Crucigramas con evaluación.</p></div></li>
      </ol>
    </main>
    <footer className={styles.footer}><span>SIARE Académico · Tu espacio de aprendizaje</span><span role="status">{ready ? "Servicio de acceso disponible" : "Servicio de acceso no disponible"}</span></footer>
  </div>;
}
