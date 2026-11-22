"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { FederatedLogin } from "./federated-login";
import { Button, LoadingState, Notice, StatusBadge, Surface } from "./ui/primitives";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { displayDate } from "../lib/display-date";
import styles from "./ui/sections.module.css";
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
  const submitting = useRef(false);
  async function load() { setLoaded(false); setError(""); try { setIdentities(await api<Identity[]>("users/me/identities")); } catch (e) { setError(e instanceof Error ? e.message : "No se pudieron consultar las identidades."); } finally { setLoaded(true); } }
  useEffect(() => { void load(); }, []);
  async function unlink(id: string) {
    if (submitting.current) return; submitting.current = true;
    setPending(true); setError(""); setMessage("");
    try { await api(`users/me/identities/${id}`, "DELETE", {}); setIdentities(items => items.filter(i => i.id !== id)); setMessage("Identidad desconectada. Se cerraron las otras sesiones."); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo desconectar."); requestAnimationFrame(() => errorRef.current?.focus()); }
    finally { submitting.current = false; setPending(false); setConfirm(undefined); }
  }
  return <Surface className={styles.stack} aria-busy={pending}>
    <span className="eyebrow">Tus vías de acceso</span>
    <h2 id="identities-title">Identidades conectadas</h2>
    <p className="muted">Vincula tus propias cuentas de Google o GitLab.com. El correo coincidente nunca conecta cuentas automáticamente.</p>
    {error && <Notice tone="error"><p ref={errorRef} tabIndex={-1}>{error}</p><Button variant="secondary" disabled={pending} onClick={load}>Volver a consultar identidades</Button></Notice>}
    {message && <p role="status" className="notice success">{message}</p>}
    {!loaded ? <LoadingState>Cargando identidades…</LoadingState> : !error && !identities.length ? <div className={styles.row}><p>No tienes identidades conectadas.</p><p className="hint">Puedes vincular una cuenta disponible desde las opciones siguientes.</p></div> : <ul className={styles.list} role="list">{identities.map(i => <li key={i.id} className={styles.row}>
      <div className={styles.header}><h3>{providerName(i.provider)}</h3><StatusBadge>Vinculada</StatusBadge></div><p className="hint">Vinculada el {displayDate(i.linkedAt, true)}</p>
      <Button variant="secondary" disabled={pending} onClick={() => setConfirm(i.id)}>Desconectar {providerName(i.provider)}</Button>
    </li>)}</ul>}
    <FederatedLogin link />
    <ConfirmDialog open={!!confirm} title="Desconectar identidad" confirmLabel="Confirmar desconexión" busy={pending} onClose={() => setConfirm(undefined)} onConfirm={() => { if (confirm) void unlink(confirm); }}><p>Se desconectará {providerName(identities.find(i => i.id === confirm)?.provider ?? "")} y se cerrarán las otras sesiones. Debes conservar una vía de acceso y haber iniciado sesión hace menos de cinco minutos.</p></ConfirmDialog>
  </Surface>;
}
