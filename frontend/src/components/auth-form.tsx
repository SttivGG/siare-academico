"use client";

import Link from "next/link";
import { Button, Field } from "./ui/primitives";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";

export function AuthForm({ register = false, embedded = false, onPendingChange }: { register?: boolean; embedded?: boolean; onPendingChange?: (pending: boolean) => void }) {
  const router = useRouter();
  const errorRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const submitting = useRef(false);
  useEffect(() => {
    if (error && !pending) errorRef.current?.focus();
  }, [error, pending]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return; submitting.current = true;
    const form = new FormData(event.currentTarget);
    setPending(true); onPendingChange?.(true); setError(""); setFields({});
    try {
      const body = { email: String(form.get("email")), password: String(form.get("password")),
        ...(register ? { name: String(form.get("name")) } : {}) };
      const result = await api<{ mfaRequired?: boolean; enrollmentRequired?: boolean }>(`auth/${register ? "register" : "login"}`, "POST", body);
      router.replace(register ? "/login?registro=1" : result.mfaRequired ? `/login/mfa${result.enrollmentRequired ? "?configurar=1" : ""}` : "/inicio");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo continuar.");
      if (err instanceof ApiError) setFields(err.fields);
    } finally { submitting.current = false; setPending(false); onPendingChange?.(false); }
  }
  return <form onSubmit={submit} className="form-stack" aria-busy={pending}>
    {error && <div ref={errorRef} tabIndex={-1} className="notice error" role="alert"><p>{error}</p>{Object.entries(fields).some(([, message]) => message) && <ul>{Object.entries(fields).filter(([, message]) => message).map(([field, message]) => <li key={field}><a href={`#${field}`}>{message}</a></li>)}</ul>}{register && /registro público.*cerrado/i.test(error) && <Link href="/login">Entrar con una cuenta existente</Link>}</div>}
    {register && <Field label="Nombre" id="name" name="name" autoComplete="name" required maxLength={100} error={fields.name} />}
    <Field label="Correo electrónico" id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} error={fields.email} onChange={() => setFields(previous => ({ ...previous, email: "" }))} />
    <Field label="Contraseña" id="password" name="password" type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 15 : 1} maxLength={2048} error={fields.password} hint={register ? "Una frase de 15 a 1024 caracteres. Puedes usar espacios y Unicode; evita frases comunes." : "Usa la contraseña de tu cuenta SIARE."} />
    <Button className="full" busy={pending} type="submit">{pending ? "Un momento…" : register ? "Crear cuenta" : "Iniciar sesión"}</Button>
    {!embedded && <p className="muted">{register ? "¿Ya tienes una cuenta?" : "¿Es tu primera visita?"} <Link href={register ? "/login" : "/registro"}>{register ? "Inicia sesión" : "Crea tu cuenta"}</Link></p>}
    {!register && <Link href="/recuperar">Olvidé mi contraseña</Link>}
  </form>;
}
