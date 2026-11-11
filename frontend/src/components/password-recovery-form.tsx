"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

export function PasswordRecoveryForm({ complete = false }: { complete?: boolean }) {
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const alertRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  useEffect(() => {
    if (complete && !initialized.current) {
      initialized.current = true;
      setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [complete]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setPending(true); setError(""); setMessage("");
    try {
      if (complete && form.get("password") !== form.get("confirmation")) throw new Error("Las contraseñas no coinciden.");
      const result = await api<{ message: string }>(`auth/password-reset/${complete ? "complete" : "request"}`, "POST", complete ? { token, password: form.get("password") } : { email: form.get("email") });
      setMessage(result.message); if (complete) setToken("");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo continuar."); requestAnimationFrame(() => alertRef.current?.focus()); }
    finally { setPending(false); }
  }
  return <form className="form-stack" onSubmit={submit} aria-busy={pending}>
    {error && <div ref={alertRef} role="alert" tabIndex={-1} className="notice error">{error}</div>}
    {message && <p role="status" className="notice success">{message}</p>}
    {complete ? <><p>El enlace vence a los quince minutos y solo puede usarse una vez. Tus sesiones anteriores se cerrarán; MFA seguirá activo.</p>
      {!token && !message && <p className="notice">Abre el enlace completo del correo. Si venció, solicita uno nuevo.</p>}
      <div className="field"><label htmlFor="new-password">Nueva contraseña</label><input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={15} maxLength={2048} aria-describedby="new-password-help" /><span id="new-password-help" className="hint">Una frase de 15 a 1024 caracteres; evita contraseñas comunes.</span></div>
      <div className="field"><label htmlFor="password-confirmation">Confirma la nueva contraseña</label><input id="password-confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={15} maxLength={2048} /></div></>
      : <><p>Escribe el correo registrado en tu cuenta. Si está disponible, recibirás las instrucciones de recuperación.</p><div className="field"><label htmlFor="recovery-email">Correo electrónico</label><input id="recovery-email" name="email" type="email" autoComplete="email" required maxLength={254} /></div></>}
    <button className="button primary" disabled={pending || (complete && !token)}>{pending ? "Un momento…" : complete ? "Guardar nueva contraseña" : "Solicitar recuperación"}</button>
    <Link href={complete ? "/recuperar" : "/login"}>{complete ? "Solicitar otro enlace" : "Volver a iniciar sesión"}</Link>
    {complete && message && <Link href="/login">Iniciar sesión con mi nueva contraseña</Link>}
  </form>;
}
