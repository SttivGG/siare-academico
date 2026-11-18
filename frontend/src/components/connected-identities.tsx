"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { FederatedLogin } from "./federated-login";
type Identity = { id: string; provider: string; linkedAt: string };
const providerName = (provider: string) => provider === "google" ? "Google" : provider === "gitlab" ? "GitLab" : "Proveedor retirado";
export function ConnectedIdentities() {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<string>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { api<Identity[]>("users/me/identities").then(setIdentities).catch(e => setError(e.message)).finally(() => setLoaded(true)); }, []);
  async function unlink(id: string) {
    setPending(true); setError(""); setMessage("");
    try { await api(`users/me/identities/${id}`, "DELETE", {}); setIdentities(items => items.filter(i => i.id !== id)); setMessage("Identidad desconectada. Se cerraron las otras sesiones."); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo desconectar."); requestAnimationFrame(() => errorRef.current?.focus()); }
    finally { setPending(false); setConfirm(undefined); }
  }
  return <section className="panel form-stack" aria-labelledby="identities-title" aria-busy={pending}>
    <h2 id="identities-title">Identidades conectadas</h2>
    <p className="muted">Vincula tus propias cuentas de Google o GitLab.com. El correo coincidente nunca conecta cuentas automáticamente.</p>
    {error && <p ref={errorRef} tabIndex={-1} className="notice error" role="alert">{error}</p>}
    {message && <p role="status" className="notice success">{message}</p>}
    {!loaded ? <p>Cargando identidades…</p> : !identities.length ? <p>No tienes identidades conectadas.</p> : <ul>{identities.map(i => <li key={i.id}>
      <p>{providerName(i.provider)} · vinculada el {new Date(i.linkedAt).toLocaleDateString("es-CO")}</p>
      {confirm === i.id ? <div className="form-stack"><p>¿Confirmas que quieres desconectar esta identidad? Debes conservar una vía de acceso y haber iniciado sesión hace menos de cinco minutos.</p>
        <button type="button" className="button secondary" disabled={pending} onClick={() => unlink(i.id)}>Confirmar desconexión</button>
        <button type="button" className="button secondary" disabled={pending} onClick={() => setConfirm(undefined)}>Cancelar</button></div>
        : <button type="button" className="button secondary" disabled={pending} onClick={() => setConfirm(i.id)}>Desconectar {providerName(i.provider)}</button>}
    </li>)}</ul>}
    <FederatedLogin link />
  </section>;
}
