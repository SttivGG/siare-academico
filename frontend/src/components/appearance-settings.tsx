"use client";

import { useId, useState } from "react";
import { BACKGROUNDS } from "../lib/appearance";
import { useAppearance, setAppearance, resetAppearance } from "../lib/appearance-store";
import { ThemeControl } from "./ui/theme-control";
import { Button } from "./ui/primitives";
import { Icon } from "./ui/icon";
import styles from "./appearance-settings.module.css";

export function AppearanceSettings() {
  const { appearance, blocked } = useAppearance();
  const [message, setMessage] = useState("");
  const id = useId();
  const background = BACKGROUNDS.find(item => item.id === appearance.background)!;
  return <div className={styles.page}>
    <div className="page-heading"><p className="eyebrow">Tu espacio, a tu manera</p><h1>Apariencia</h1><p className="section-intro">Elige el ambiente en el que te gusta aprender. Los cambios se aplican al instante.</p></div>
    <div className={styles.layout}>
      <div className={styles.settings}>
        <section className={`panel ${styles.section}`} aria-labelledby={`${id}-theme`}><div><span className="small-label">01 / Color</span><h2 id={`${id}-theme`}>Tema de la interfaz</h2><p className="hint">Claro, oscuro o al ritmo de tu sistema.</p></div><ThemeControl /></section>
        <section className={`panel ${styles.section}`} aria-labelledby={`${id}-background`}><div><span className="small-label">02 / Ambiente</span><h2 id={`${id}-background`}>Imagen de fondo</h2><p className="hint">Un lugar para concentrarte. Seleccionado: {background.label}.</p></div>
          <fieldset className={styles.gallery}><legend className="sr-only">Imagen de fondo</legend>{BACKGROUNDS.map(item => <label key={item.id} className={styles.background} data-selected={item.id === appearance.background}>
            <input type="radio" name={`${id}-background-choice`} value={item.id} checked={appearance.background === item.id} onChange={() => { setAppearance({ background: item.id }); setMessage(""); }} />
            {item.thumbnail ? <img src={item.thumbnail} alt="" width={360} height={210} loading="lazy" decoding="async" /> : <span className={styles.noImage} aria-hidden="true"><Icon name="appearance" />Solo color</span>}
            <span className={styles.backgroundLabel}>{item.label}</span>
          </label>)}</fieldset>
        </section>
        <section className={`panel ${styles.section}`} aria-labelledby={`${id}-glass`}><div><span className="small-label">03 / Cristal</span><h2 id={`${id}-glass`}>Luz y profundidad</h2><p className="hint">Ajusta las superficies; los textos, campos y diálogos conservan su protección de lectura.</p></div>
          <div className={styles.slider}><label htmlFor={`${id}-transparency`}>Transparencia del cristal <output htmlFor={`${id}-transparency`}>{appearance.transparency}%</output></label><input id={`${id}-transparency`} type="range" min="20" max="72" step="1" value={appearance.transparency} onChange={event => setAppearance({ transparency: Number(event.target.value) })} /><p className="hint">De más sólido a más transparente. El límite conserva la legibilidad.</p></div>
          <div className={styles.slider}><label htmlFor={`${id}-blur`}>Desenfoque <output htmlFor={`${id}-blur`}>{appearance.blur} px</output></label><input id={`${id}-blur`} type="range" min="0" max="24" step="1" value={appearance.blur} onChange={event => setAppearance({ blur: Number(event.target.value) })} /><p className="hint">Sin desenfoque a cristal difuminado.</p></div>
          <div className={styles.slider}><label htmlFor={`${id}-veil`}>Velo neutro del fondo <output htmlFor={`${id}-veil`}>{appearance.veil}%</output></label><input id={`${id}-veil`} type="range" min="0" max="100" step="1" value={appearance.veil} onChange={event => setAppearance({ veil: Number(event.target.value) })} /><p className="hint">Suaviza la fotografía sin cambiar sus colores naturales.</p></div>
          <p className={styles.accessibilityNote}>Si tu dispositivo solicita menos transparencia o colores forzados, priorizamos esa preferencia.</p>
        </section>
        <section className={`panel ${styles.section}`} aria-label="Restaurar apariencia"><h2>Volver al punto de partida</h2><p className="hint">Restablece tema Sistema, fondo educativo, transparencia 72%, desenfoque 10 px y velo 50%. Conserva el ancho elegido de la navegación.</p><Button variant="secondary" onClick={() => { resetAppearance(); setMessage("Apariencia predeterminada restaurada."); }}>Restaurar apariencia predeterminada</Button><p role="status" className="hint">{message}</p></section>
      </div>
      <aside className={styles.preview} aria-label="Vista previa de la apariencia"><div className={`panel ${styles.previewPanel}`}><span className="small-label">Vista previa en directo</span><div className={styles.previewHeading}><span className={styles.previewMark}><Icon name="study" /></span><div><h2>Un espacio para aprender</h2><p className="hint">{background.label}</p></div></div><div className={styles.sample}><span className="small-label">Mi cuaderno</span><h3>Cada idea empieza aquí.</h3><p>Tu contenido sigue siendo el protagonista, con el ambiente que tú eliges.</p><span className={styles.sampleTag}>SIARE Académico</span></div><p className="hint">La barra, el encabezado y estas tarjetas ya muestran tu configuración.</p></div><p className={styles.persistence} role="status">{blocked ? "El navegador no permite guardarlo. Conservaremos la apariencia durante esta visita." : "Preferencias guardadas en este navegador y dispositivo. También se aplican a las pantallas de acceso."}</p></aside>
    </div>
  </div>;
}
