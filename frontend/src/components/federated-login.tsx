"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ProviderButton } from "./ui/primitives";
import { api } from "../lib/api";
import type { Provider } from "../lib/oidc-policy";
import { diagnosticCode } from "../lib/oidc-policy";

export function FederatedLogin({ link = false, showIcons = false }: { link?: boolean; showIcons?: boolean }) {
  const [available, setAvailable] = useState<Provider[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const submitting = useRef(false);
  function load() { setLoaded(false); setError(""); return api<{ provider: Provider; enabled: boolean }[]>("auth/oidc/providers")
    .then(data => setAvailable(data.filter(p => p.enabled).map(p => p.provider)))
    .catch(() => setError("No se pudo consultar el inicio de sesión externo. Puedes reintentar o usar tu contraseña."))
    .finally(() => setLoaded(true)); }
  useEffect(() => { void load(); }, []);
  async function start(provider: Provider) {
    if (submitting.current) return; submitting.current = true;
    setPending(true); setError("");
    try {
      const response = await fetch("/api/oidc/start", { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-SIARE-CSRF": "1" }, body: JSON.stringify({ provider, link, confirmed }) });
      const data = await response.json();
      if (!response.ok) throw new Error(`${data.message ?? "No se pudo iniciar la conexión."}${data.code ? ` Diagnóstico: ${diagnosticCode(data.code)}.` : ""}`);
      window.location.assign(data.authorizationUrl);
    } catch (e) { submitting.current = false; setError(e instanceof Error ? e.message : "Vuelve a intentarlo."); setPending(false); requestAnimationFrame(() => errorRef.current?.focus()); }
  }
  return <div className="form-stack" aria-busy={pending}>
    {error && <p ref={errorRef} tabIndex={-1} className="notice error" role="alert">{error}</p>}
    {error && <Button variant="secondary" disabled={pending} onClick={load}>Consultar proveedores de nuevo</Button>}
    {link && <label className="hint"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> Confirmo que quiero vincular a mi cuenta SIARE la identidad que seleccionaré.</label>}
    {(["google", "gitlab"] as Provider[]).map(provider => <div key={provider}>
      <ProviderButton disabled={!loaded || pending || !available.includes(provider) || link && !confirmed}
        aria-describedby={`${link ? "link" : "login"}-${provider}-status`} onClick={() => start(provider)}>
        {showIcons && <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24">{provider === "google" ? <><path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.6h3.2c1.9-1.8 3-4.3 3-7.5Z"/><path fill="#34a853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5a6 6 0 0 1-9-3.1H3v2.6A10 10 0 0 0 12 22Z"/><path fill="#fbbc05" d="M6.4 14a6 6 0 0 1 0-4V7.4H3a10 10 0 0 0 0 9.2Z"/><path fill="#ea4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9 5.4L6.4 10A6 6 0 0 1 12 6Z"/></> : <><path fill="#e24329" d="m12 22-4.4-13h8.8Z"/><path fill="#fc6d26" d="m12 22 8-13h-5.6ZM12 22 4 9h5.6Z"/><path fill="#fca326" d="m4 9-1.5 4.6L12 22ZM20 9l1.5 4.6L12 22Z"/><path fill="#e24329" d="M4 9 6 3l2 6ZM16 9l2-6 2 6Z"/></>}</svg>}
        {showIcons && !link ? "" : link ? "Vincular " : "Continuar con "}{provider === "google" ? "Google" : "GitLab"}</ProviderButton>
      <p id={`${link ? "link" : "login"}-${provider}-status`} className="hint">{!loaded ? "Consultando disponibilidad…" : available.includes(provider) ? link ? "Requiere haber iniciado sesión en los últimos cinco minutos." : "Selecciona tu cuenta para continuar." : "Proveedor no configurado."}</p>
    </div>)}
  </div>;
}
