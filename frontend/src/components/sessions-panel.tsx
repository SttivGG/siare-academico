"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Session = { id: string; createdAt: string; lastSeenAt: string; absoluteExpiresAt: string };
export function SessionsPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function load() { setSessions(await api<Session[]>("users/me/sessions")); }
  useEffect(() => { load().catch(e => setError(e.message)).finally(() => setPending(false)); }, []);
  async function revoke(path: string, method: string) {
    setPending(true); setError(""); setMessage("");
    try {
      await api(path, method);
      if (path.endsWith("revoke-all")) { window.location.assign("/login?sesion=expirada"); return; }
      await load(); setMessage("Las sesiones seleccionadas se han cerrado.");
    }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo cerrar la sesión."); }
    finally { setPending(false); }
  }
  return <section aria-busy={pending}>
    <div className="actions"><button className="button secondary" disabled={pending} onClick={() => revoke("users/me/sessions/revoke-others", "POST")}>Cerrar otras sesiones</button>
      <button className="button subtle" disabled={pending} onClick={() => revoke("users/me/sessions/revoke-all", "POST")}>Cerrar todas las sesiones</button></div>
    {pending && <p role="status">Actualizando sesiones…</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {message && <p className="notice" role="status">{message}</p>}
    <ul className="sessions-list">{sessions.map(s => <li key={s.id} className="subject-card">
      <h2>Sesión iniciada el {new Date(s.createdAt).toLocaleString("es-CO")}</h2>
      <p className="muted">Última actividad: {new Date(s.lastSeenAt).toLocaleString("es-CO")}</p>
      <p className="hint">Caduca como máximo el {new Date(s.absoluteExpiresAt).toLocaleString("es-CO")}</p>
      <button className="button secondary" disabled={pending} onClick={() => revoke(`users/me/sessions/${s.id}`, "DELETE")}>Cerrar esta sesión</button>
    </li>)}</ul>
    {!pending && !error && sessions.length === 0 && <p>No hay sesiones activas.</p>}
  </section>;
}
