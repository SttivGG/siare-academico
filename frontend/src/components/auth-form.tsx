"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, ApiError } from "../lib/api";

export function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const errorRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true); setError(""); setFields({});
    try {
      const body = { email: String(form.get("email")), password: String(form.get("password")),
        ...(register ? { name: String(form.get("name")) } : {}) };
      await api(`auth/${register ? "register" : "login"}`, "POST", body);
      router.replace(register ? "/login?registro=1" : "/inicio");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo continuar.");
      if (err instanceof ApiError) setFields(err.fields);
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { setPending(false); }
  }
  return <form onSubmit={submit} className="form-stack" aria-busy={pending}>
    {error && <div ref={errorRef} tabIndex={-1} className="notice error" role="alert">{error}</div>}
    {register && <div className="field"><label htmlFor="name">Nombre</label>
      <input id="name" name="name" autoComplete="name" required maxLength={100} aria-invalid={!!fields.name} aria-describedby={fields.name ? "name-error" : undefined} />
      {fields.name && <span id="name-error" className="field-error">{fields.name}</span>}</div>}
    <div className="field"><label htmlFor="email">Correo electrónico</label>
      <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} aria-invalid={!!fields.email} aria-describedby={fields.email ? "email-error" : undefined} />
      {fields.email && <span id="email-error" className="field-error">{fields.email}</span>}</div>
    <div className="field"><label htmlFor="password">Contraseña</label>
      <input id="password" name="password" type="password" autoComplete={register ? "new-password" : "current-password"}
        required minLength={register ? 10 : 1} maxLength={72} aria-invalid={!!fields.password} aria-describedby="password-help" />
      <span id="password-help" className={fields.password ? "field-error" : "hint"}>{fields.password ?? (register ? "Al menos 10 caracteres. Máximo 72 bytes (algunos símbolos ocupan más de uno)." : "Usa la contraseña de tu cuenta SIARE.")}</span></div>
    <button className="button primary full" disabled={pending} type="submit">{pending ? "Un momento…" : register ? "Crear cuenta" : "Iniciar sesión"}</button>
    <p className="muted">{register ? "¿Ya tienes una cuenta?" : "¿Es tu primera visita?"} <Link href={register ? "/login" : "/registro"}>{register ? "Inicia sesión" : "Crea tu cuenta"}</Link></p>
  </form>;
}
