"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
type Access = { userId: string; role: string; scopeId: string; enabled: boolean; version: number };
type Scope = { id: string; name: string };
type Event = { id: string; operation: string; occurredAt: string; outcome: string; resource: string };

export function AdministrationPanel({ role }: { role: string }) {
  const [users, setUsers] = useState<Access[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [parameter, setParameter] = useState<{ enabled: boolean; version: number }>();
  async function load() {
    const [u, s] = await Promise.all([api<Access[]>("admin/users"), api<Scope[]>("admin/scopes")]);
    setUsers(u); setScopes(s);
    if (role === "SUPERADMIN") {
      setEvents(await api<Event[]>("admin/audit"));
      setParameter(await api("admin/parameters/public-registration"));
    }
  }
  async function createScope(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const name = new FormData(form).get("name");
    setPending(true); setError(""); setMessage("");
    try { await api("admin/scopes", "POST", { name }); await load(); form.reset(); setMessage("Ámbito creado."); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo crear el ámbito."); }
    finally { setPending(false); }
  }
  async function toggleRegistration() {
    if (!parameter) return;
    setPending(true); setError(""); setMessage("");
    try { setParameter(await api("admin/parameters/public-registration", "PATCH", { enabled: !parameter.enabled, version: parameter.version })); setMessage("Registro público actualizado."); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar el parámetro."); }
    finally { setPending(false); }
  }
  useEffect(() => { load().catch(e => setError(e.message)).finally(() => setPending(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function save(event: React.FormEvent<HTMLFormElement>, user: Access) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    setPending(true); setError(""); setMessage("");
    try {
      await api(`admin/users/${user.userId}/access`, "PATCH", { role: data.get("role") ?? user.role,
        scopeId: data.get("scope") ?? user.scopeId, enabled: data.get("enabled") === "on", version: user.version });
      await load(); setMessage("Asignación actualizada y sesiones del usuario revocadas.");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); }
    finally { setPending(false); }
  }
  return <section aria-busy={pending}>
    {pending && <p role="status">Cargando administración…</p>}{error && <p role="alert" className="notice error">{error}</p>}
    {message && <p role="status" className="notice">{message}</p>}
    {role === "SUPERADMIN" && <section className="form-stack"><h2>Ámbitos y parámetros</h2>
      <form onSubmit={createScope} className="field"><label htmlFor="scope-name">Nombre del nuevo ámbito</label><input id="scope-name" name="name" required maxLength={100} />
        <button className="button secondary" disabled={pending}>Crear ámbito</button></form>
      {parameter && <button className="button secondary" disabled={pending} onClick={toggleRegistration}>{parameter.enabled ? "Cerrar registro público" : "Abrir registro público"}</button>}
    </section>}
    <h2>Usuarios del ámbito</h2><p className="muted">Se muestran hasta 50 asignaciones. Los permisos se comprueban en el servidor.</p>
    {users.map(u => <form key={u.userId} onSubmit={e => save(e, u)} className="subject-card form-stack">
      <p className="identity-id">Usuario: {u.userId}</p>
      {role === "SUPERADMIN" && u.role !== "SUPERADMIN" ? <>
        <label>Rol<select name="role" defaultValue={u.role}><option value="USER">USER</option><option value="ADMIN">ADMIN</option></select></label>
        <label>Ámbito<select name="scope" defaultValue={u.scopeId}>{scopes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      </> : <p>{u.role} · {scopes.find(s => s.id === u.scopeId)?.name ?? "Ámbito restringido"}</p>}
      <label><input name="enabled" type="checkbox" defaultChecked={u.enabled} /> Cuenta habilitada</label>
      <button className="button secondary" disabled={pending || u.role === "SUPERADMIN"}>Guardar asignación</button>
    </form>)}
    {role === "SUPERADMIN" && <><h2>Auditoría reciente</h2><ul>{events.map(e => <li key={e.id}>{new Date(e.occurredAt).toLocaleString("es-CO")} · {e.operation} · {e.outcome} · {e.resource}</li>)}</ul></>}
  </section>;
}
