"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { displayDate } from "../lib/display-date";
import { Button, EmptyState, Field, LoadingState, Notice, Select, StatusBadge, Surface } from "./ui/primitives";
import { ConfirmDialog } from "./ui/confirm-dialog";
import styles from "./ui/sections.module.css";

type Access = { userId: string; role: string; scopeId: string; enabled: boolean; version: number };
type Scope = { id: string; name: string };
type AuditEvent = { id: string; operation: string; occurredAt: string; outcome: string; resource: string };
type Parameter = { enabled: boolean; version: number };
type Change = { kind: "access"; user: Access; body: { role: string; scopeId: string; enabled: boolean; version: number } } | { kind: "registration"; parameter: Parameter };

export function AdministrationPanel({ role, actorId }: { role: string; actorId: string }) {
  const [users, setUsers] = useState<Access[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [pending, setPending] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [parameter, setParameter] = useState<Parameter>();
  const [change, setChange] = useState<Change>();
  const submitting = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const superadmin = role === "SUPERADMIN";
  async function load() {
    const [u, s, a, p] = await Promise.all([api<Access[]>("admin/users"), api<Scope[]>("admin/scopes"), superadmin ? api<AuditEvent[]>("admin/audit") : Promise.resolve([]), superadmin ? api<Parameter>("admin/parameters/public-registration") : Promise.resolve(undefined)]);
    setUsers(u); setScopes(s); setEvents(a); setParameter(p); setLoaded(true);
  }
  function report(e: unknown) {
    setError(e instanceof Error ? e.message : "No se pudo completar la operación.");
    setConflict(e instanceof ApiError && e.status === 409);
    requestAnimationFrame(() => errorRef.current?.focus());
  }
  async function refresh() {
    if (submitting.current) return;
    submitting.current = true; setPending(true); setError(""); setConflict(false);
    try { await load(); } catch (e) { report(e); }
    finally { submitting.current = false; setPending(false); }
  }
  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function createScope(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current) return;
    const form = event.currentTarget; const name = new FormData(form).get("name");
    submitting.current = true; setPending(true); setError(""); setMessage(""); setConflict(false);
    try { await api("admin/scopes", "POST", { name }); form.reset(); setMessage("Ámbito creado."); await load(); }
    catch (e) { report(e); }
    finally { submitting.current = false; setPending(false); }
  }
  function prepare(event: React.FormEvent<HTMLFormElement>, user: Access) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    setChange({ kind: "access", user, body: { role: String(data.get("role") ?? user.role), scopeId: String(data.get("scope") ?? user.scopeId), enabled: data.get("enabled") === "on", version: user.version } });
  }
  async function apply() {
    if (!change || submitting.current) return;
    submitting.current = true; setPending(true); setError(""); setMessage(""); setConflict(false);
    try {
      if (change.kind === "access") {
        await api(`admin/users/${change.user.userId}/access`, "PATCH", change.body);
        setMessage("Asignación actualizada y sesiones del usuario revocadas."); await load();
      } else {
        setParameter(await api<Parameter>("admin/parameters/public-registration", "PATCH", { enabled: !change.parameter.enabled, version: change.parameter.version }));
        setMessage("Registro público actualizado.");
      }
    } catch (e) { report(e); }
    finally { submitting.current = false; setPending(false); setChange(undefined); }
  }
  return <div className={styles.stack} aria-busy={pending}>
    {pending && <LoadingState>Cargando administración…</LoadingState>}
    {error && <div ref={errorRef} tabIndex={-1}><Notice tone="error"><p>{error}</p>{conflict && <p>Otra actualización cambió la versión. Conservamos los valores del formulario. Consulta los datos actuales antes de volver a confirmar.</p>}<Button variant="secondary" disabled={pending} onClick={refresh}>{conflict ? "Consultar versión actual" : "Volver a consultar administración"}</Button></Notice></div>}
    {message && <Notice tone="success">{message}</Notice>}
    {loaded && <>
      {superadmin && <div className={styles.grid}>
        <Surface className={styles.stack}><div><span className="eyebrow">Organización</span><h2>Ámbitos</h2></div>
          {!scopes.length ? <p className="muted">Todavía no hay ámbitos disponibles.</p> : <ul className={styles.list} role="list">{scopes.map(s => <li key={s.id} className={styles.row}>{s.name}</li>)}</ul>}
          <form onSubmit={createScope} className="form-stack" aria-label="Crear ámbito"><Field label="Nombre del nuevo ámbito" id="scope-name" name="name" required maxLength={100} /><Button type="submit" variant="secondary" busy={pending}>Crear ámbito</Button></form>
        </Surface>
        <Surface className={styles.stack}><div><span className="eyebrow">Acceso público</span><h2>Registro de cuentas</h2></div>
          {parameter && <><StatusBadge>{parameter.enabled ? "Registro abierto" : "Registro cerrado"}</StatusBadge><p className="muted">Controla la creación pública de cuentas. Las identidades existentes conservan su acceso.</p><p className="hint">Versión actual: {parameter.version}</p><Button variant="secondary" disabled={pending} onClick={() => setChange({ kind: "registration", parameter })}>{parameter.enabled ? "Cerrar registro público" : "Abrir registro público"}</Button></>}
        </Surface>
      </div>}
      <Surface className={styles.stack}><div className={styles.header}><div><span className="eyebrow">{superadmin ? "Todos los ámbitos autorizados" : "Tu ámbito autorizado"}</span><h2>Usuarios del ámbito</h2><p className="muted">Se muestran hasta 50 asignaciones. Los permisos se comprueban en el servidor.</p></div><StatusBadge>{users.length} asignaciones</StatusBadge></div>
        {!users.length && <EmptyState title="Sin asignaciones disponibles"><p className="muted">No hay usuarios en el resultado autorizado para tu cuenta.</p></EmptyState>}
        <ul className={styles.list} role="list">{users.map(u => {
          const editable = u.userId !== actorId && u.role !== "SUPERADMIN" && (superadmin || u.role === "USER");
          return <li key={`${u.userId}-${u.version}`} className={styles.row}><form onSubmit={e => prepare(e, u)} className="form-stack" aria-label={`Asignación de ${u.userId}`}><fieldset disabled={pending || !editable} className="form-stack"><legend>Usuario: {u.userId}</legend>
            <div className={styles.header}><StatusBadge>{u.role}</StatusBadge><span className="hint">Versión {u.version} · {u.enabled ? "Habilitada" : "Deshabilitada"}</span></div>
            {superadmin && u.role !== "SUPERADMIN" ? <div className={styles.operations}>
              <Select label="Rol" name="role" defaultValue={u.role}><option value="USER">USER</option><option value="ADMIN">ADMIN</option></Select>
              <Select label="Ámbito" name="scope" defaultValue={u.scopeId}>{scopes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            </div> : <p className="muted">{scopes.find(s => s.id === u.scopeId)?.name ?? "Ámbito restringido"}</p>}
            <label className={styles.check}><input name="enabled" type="checkbox" defaultChecked={u.enabled} /> Cuenta habilitada</label>
            <Button type="submit" variant="secondary" disabled={!editable || pending}>Guardar asignación</Button>
          </fieldset>{!editable && <p className="hint">{u.userId === actorId ? "Tu propia asignación está protegida." : "Tu rol no permite modificar esta asignación."}</p>}</form></li>;
        })}</ul>
      </Surface>
      {superadmin && <Surface className={styles.stack}><div><span className="eyebrow">Trazabilidad</span><h2>Auditoría reciente</h2><p className="muted">Hasta 50 eventos registrados por el servidor.</p></div>
        {!events.length ? <EmptyState title="Sin eventos en esta consulta"><p className="muted">No hay registros de auditoría disponibles en el resultado actual.</p></EmptyState> : <ul className={styles.list} role="list">{events.map(e => <li key={e.id} className={styles.row}><div className={styles.header}><h3>{e.operation}</h3><StatusBadge>{e.outcome}</StatusBadge></div><p className="hint">{displayDate(e.occurredAt)}</p><p className="identity-id">{e.resource}</p></li>)}</ul>}
      </Surface>}
    </>}
    <ConfirmDialog open={!!change} title={change?.kind === "registration" ? "Actualizar registro público" : "Actualizar asignación"} confirmLabel="Confirmar actualización" busy={pending} onClose={() => setChange(undefined)} onConfirm={apply}>
      {change?.kind === "access" ? <><p className="identity-id">Usuario: {change.user.userId}</p><p>Rol: {change.body.role} · {scopes.find(s => s.id === change.body.scopeId)?.name ?? "Ámbito seleccionado"} · {change.body.enabled ? "Habilitada" : "Deshabilitada"}.</p><p>Se revocarán las sesiones de esta cuenta. El servidor validará tus permisos y la versión {change.body.version} antes de guardar.</p></> : <p>{change?.kind === "registration" && (change.parameter.enabled ? "Se cerrará el registro público de nuevas cuentas." : "Se abrirá el registro público de nuevas cuentas.")} La configuración cambiará solo después de confirmar el servidor.</p>}
    </ConfirmDialog>
  </div>;
}
