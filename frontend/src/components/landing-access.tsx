"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { AuthForm } from "./auth-form";
import { FederatedLogin } from "./federated-login";
import styles from "./landing.module.css";

export function LandingAccess() {
  const [register, setRegister] = useState(false);
  const [pending, setPending] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  function select(value: boolean) { if (!pending) setRegister(value); }
  function navigate(event: KeyboardEvent<HTMLButtonElement>) {
    if (pending || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? false : event.key === "End" ? true : !register;
    select(next); tabs.current[Number(next)]?.focus();
  }
  return <div className={styles.access}>
    <div className={styles.tabs} role="tablist" aria-label="Acceso a SIARE">
      {["Iniciar sesión", "Registrarse"].map((label, index) => <button key={label} ref={node => { tabs.current[index] = node; }} id={`access-tab-${index}`} role="tab" type="button" aria-selected={register === Boolean(index)} tabIndex={register === Boolean(index) ? 0 : -1} aria-disabled={pending || undefined} onClick={() => select(Boolean(index))} onKeyDown={navigate}>{label}</button>)}
    </div>
    <div role="tabpanel" aria-labelledby={`access-tab-${Number(register)}`}>
      <div className={styles.panelIntro}><h2>{register ? "Tu próximo paso empieza aquí" : "Qué bueno verte de nuevo"}</h2><p className="muted">{register ? "Tres datos para crear tu espacio de estudio." : "Entra a tu espacio y sigue aprendiendo."}</p></div>
      <AuthForm key={String(register)} register={register} embedded onPendingChange={setPending} />
    </div>
    <div className={styles.divider}><span>o continúa con</span></div>
    <div className={styles.providers}><FederatedLogin showIcons /></div>
  </div>;
}
