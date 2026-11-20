"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { Button, Field, Notice } from "./ui/primitives";

export function PasswordRecoveryForm({ complete = false }: { complete?: boolean }) {
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const alertRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const submitting = useRef(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  useEffect(() => {
    if (complete && !initialized.current) {
      initialized.current = true;
      setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [complete]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current) return; submitting.current = true;
    const form = new FormData(event.currentTarget); setPending(true); setError(""); setMessage(""); setFields({});
    try {
      if (complete && form.get("password") !== form.get("confirmation")) { setFields({ confirmation: "Escribe la misma contraseña en ambos campos." }); throw new Error("Las contraseñas no coinciden."); }
      const result = await api<{ message: string }>(`auth/password-reset/${complete ? "complete" : "request"}`, "POST", complete ? { token, password: form.get("password") } : { email: form.get("email") });
      setMessage(result.message); if (complete) setToken("");
    } catch (e) { if (e instanceof ApiError) setFields(e.fields); setError(e instanceof Error ? e.message : "No se pudo continuar."); requestAnimationFrame(() => alertRef.current?.focus()); }
    finally { submitting.current = false; setPending(false); }
  }
  return <form className="form-stack" onSubmit={submit} aria-busy={pending}>
    {error && <div ref={alertRef} role="alert" tabIndex={-1} className="notice error">{error}</div>}
    {message && <p role="status" className="notice success">{message}</p>}
    {complete ? <><p>El enlace vence a los quince minutos y solo puede usarse una vez. Tus sesiones anteriores se cerrarán; MFA seguirá activo.</p>
      {!token && !message && <Notice tone="warning">Abre el enlace completo del correo. Si venció, solicita uno nuevo.</Notice>}
      <Field label="Nueva contraseña" id="new-password" name="password" type="password" autoComplete="new-password" required minLength={15} maxLength={2048} hint="Una frase de 15 a 1024 caracteres; evita contraseñas comunes." error={fields.password} />
      <Field label="Confirma la nueva contraseña" id="password-confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={15} maxLength={2048} error={fields.confirmation} onChange={() => setFields(previous => ({ ...previous, confirmation: "" }))} /></>
      : <><p>Escribe el correo registrado en tu cuenta. Si está disponible, recibirás las instrucciones de recuperación.</p><Field label="Correo electrónico" id="recovery-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} error={fields.email} /></>}
    <Button type="submit" busy={pending} disabled={complete && !token}>{pending ? "Un momento…" : complete ? "Guardar nueva contraseña" : "Solicitar recuperación"}</Button>
    <Link href={complete ? "/recuperar" : "/login"}>{complete ? "Solicitar otro enlace" : "Volver a iniciar sesión"}</Link>
    {complete && message && <Link href="/login">Iniciar sesión con mi nueva contraseña</Link>}
  </form>;
}
