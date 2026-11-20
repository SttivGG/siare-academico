"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ProviderButton } from "./ui/primitives";
import { api } from "../lib/api";
import type { Provider } from "../lib/oidc-policy";
import { diagnosticCode } from "../lib/oidc-policy";

export function FederatedLogin({ link = false }: { link?: boolean }) {
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
        {link ? "Vincular" : "Continuar con"} {provider === "google" ? "Google" : "GitLab"}</ProviderButton>
      <p id={`${link ? "link" : "login"}-${provider}-status`} className="hint">{!loaded ? "Consultando disponibilidad…" : available.includes(provider) ? link ? "Requiere haber iniciado sesión en los últimos cinco minutos." : "Selecciona tu cuenta para continuar." : "Proveedor no configurado."}</p>
    </div>)}
  </div>;
}
