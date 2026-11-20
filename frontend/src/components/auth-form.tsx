"use client";

import Link from "next/link";
import { Button, Field } from "./ui/primitives";
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
      const result = await api<{ mfaRequired?: boolean; enrollmentRequired?: boolean }>(`auth/${register ? "register" : "login"}`, "POST", body);
      router.replace(register ? "/login?registro=1" : result.mfaRequired ? `/login/mfa${result.enrollmentRequired ? "?configurar=1" : ""}` : "/inicio");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo continuar.");
      if (err instanceof ApiError) setFields(err.fields);
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { setPending(false); }
  }
  return <form onSubmit={submit} className="form-stack" aria-busy={pending}>
    {error && <div ref={errorRef} tabIndex={-1} className="notice error" role="alert">{error}</div>}
    {register && <Field label="Nombre" id="name" name="name" autoComplete="name" required maxLength={100} error={fields.name} />}
    <Field label="Correo electrónico" id="email" name="email" type="email" autoComplete="email" required maxLength={254} error={fields.email} />
    <Field label="Contraseña" id="password" name="password" type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 15 : 1} maxLength={2048} error={fields.password} hint={register ? "Una frase de 15 a 1024 caracteres. Puedes usar espacios y Unicode; evita frases comunes." : "Usa la contraseña de tu cuenta SIARE."} />
    <Button className="full" busy={pending} type="submit">{pending ? "Un momento…" : register ? "Crear cuenta" : "Iniciar sesión"}</Button>
    <p className="muted">{register ? "¿Ya tienes una cuenta?" : "¿Es tu primera visita?"} <Link href={register ? "/login" : "/registro"}>{register ? "Inicia sesión" : "Crea tu cuenta"}</Link></p>
    {!register && <Link href="/recuperar">Olvidé mi contraseña</Link>}
  </form>;
}
