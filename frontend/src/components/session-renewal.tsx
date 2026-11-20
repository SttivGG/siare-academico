"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { renewSession } from "../lib/renew-session";

export function SessionRenewal() {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    renewSession().then(ok => {
      if (!live) return;
      if (ok) { router.replace("/inicio"); router.refresh(); }
      else setError("Tu sesión ha expirado o fue revocada. Inicia sesión de nuevo.");
    }).catch(() => { if (live) setError("No se pudo conectar. Recarga la página para volver a intentarlo."); });
    return () => { live = false; };
  }, [router]);
  return <section aria-label="Comprobación de sesión">
    {error ? <><p className="notice error" role="alert">{error}</p><Link href="/login?sesion=expirada" className="button primary">Ir a iniciar sesión</Link></>
      : <p role="status" aria-live="polite">Renovando la sesión…</p>}</section>;
}
