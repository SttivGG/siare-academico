"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { displayDate } from "../lib/display-date";
import { Button, EmptyState, LoadingState, Notice, StatusBadge, Surface } from "./ui/primitives";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { useAcademicSession } from "./academic-provider";
import styles from "./ui/sections.module.css";

type Session = { id: string; createdAt: string; lastSeenAt: string; absoluteExpiresAt: string; current?: boolean };
type Revocation = { path: string; method: string; title: string; detail: string; all?: boolean };
export function SessionsPanel() {
  const academic = useAcademicSession();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<Revocation>();
  const submitting = useRef(false);
  async function load() { setSessions(await api<Session[]>("users/me/sessions")); }
  async function refresh() {
    setPending(true); setError("");
    try { await load(); } catch (e) { setError(e instanceof Error ? e.message : "No se pudieron consultar las sesiones."); }
    finally { setPending(false); }
  }
  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function revoke() {
    if (!confirmation || submitting.current) return;
    submitting.current = true; setPending(true); setError(""); setMessage("");
    try {
      await api(confirmation.path, confirmation.method);
      if (confirmation.all) {
        let cleared = true; try { await academic?.clear(); } catch { cleared = false; }
        window.location.assign(cleared ? "/login?sesion=expirada" : "/login?copia=error-al-eliminar"); return;
      }
      await load(); setMessage("Las sesiones seleccionadas se han cerrado.");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cerrar la sesión."); }
    finally { submitting.current = false; setPending(false); setConfirmation(undefined); }
  }
  return <Surface className={styles.stack} aria-busy={pending}>
    <div className={styles.header}><div><h2>Controla tus accesos</h2><p className="muted">Cada entrada corresponde a una sesión registrada en el servidor.</p></div><StatusBadge>{sessions.length} sesiones consultadas</StatusBadge></div>
    <div className="actions"><Button variant="secondary" disabled={pending} onClick={() => setConfirmation({ path: "users/me/sessions/revoke-others", method: "POST", title: "Cerrar otras sesiones", detail: "Continuarás en esta sesión. Los otros dispositivos deberán volver a iniciar sesión." })}>Cerrar otras sesiones</Button>
      <Button variant="danger" disabled={pending} onClick={() => setConfirmation({ path: "users/me/sessions/revoke-all", method: "POST", title: "Cerrar todas las sesiones", detail: "También saldrás de este dispositivo. Se eliminarán las copias académicas locales de esta cuenta y el trabajo en memoria.", all: true })}>Cerrar todas las sesiones</Button></div>
    {pending && <LoadingState>Actualizando sesiones…</LoadingState>}
    {error && <Notice tone="error"><p>{error}</p><Button variant="secondary" disabled={pending} onClick={refresh}>Volver a consultar sesiones</Button></Notice>}
    {message && <Notice tone="success">{message}</Notice>}
    {!pending && !error && !sessions.length && <EmptyState title="No hay sesiones activas"><p className="muted">La lista no contiene accesos activos. Puedes volver a consultarla.</p><Button variant="secondary" onClick={refresh}>Actualizar sesiones</Button></EmptyState>}
    <ul className={styles.list} role="list">{sessions.map(s => <li key={s.id} data-session-id={s.id} className={styles.row}>
      <div className={styles.header}><h3>Sesión iniciada el {displayDate(s.createdAt)}</h3>{s.current === true && <StatusBadge>Sesión actual</StatusBadge>}</div>
      <dl className={styles.meta}><div><dt>Última actividad</dt><dd>{displayDate(s.lastSeenAt)}</dd></div><div><dt>Vencimiento máximo</dt><dd>{displayDate(s.absoluteExpiresAt)}</dd></div></dl>
      <Button variant="secondary" disabled={pending} onClick={() => setConfirmation({ path: `users/me/sessions/${s.id}`, method: "DELETE", title: "Cerrar esta sesión", detail: `Se revocará el acceso iniciado el ${displayDate(s.createdAt)}. Si corresponde a este dispositivo, deberás iniciar sesión de nuevo.` })}>Cerrar esta sesión</Button>
    </li>)}</ul>
    {!sessions.some(s => typeof s.current === "boolean") && <p className="hint">El servidor no identifica la sesión actual en esta lista. Usa «Cerrar otras sesiones» para conservar este acceso.</p>}
    <ConfirmDialog open={!!confirmation} title={confirmation?.title ?? "Cerrar sesiones"} confirmLabel="Confirmar cierre" busy={pending} onClose={() => setConfirmation(undefined)} onConfirm={revoke}><p>{confirmation?.detail}</p></ConfirmDialog>
  </Surface>;
}
