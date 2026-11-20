"use client";
import { useEffect, useState, useSyncExternalStore } from 'react';
import { api, type Student, type Subject } from '../lib/api';
import { hasWork } from '../lib/academic-state';
import type { RecoveryRecord } from '../lib/academic-recovery';
import type { Activity, Evaluation } from '../lib/activities';
import type { Document } from './subject-documents';
import { useAcademic } from './academic-provider';
import { Dialog } from './ui/dialog';

export function AcademicRecovery({ subjectId }: { subjectId: string }) {
  const { controller, recovery } = useAcademic(subjectId);
  const status = useSyncExternalStore(recovery.subscribe, recovery.getSnapshot, recovery.getSnapshot);
  const [action, setAction] = useState<'enable' | 'unlock' | 'discard' | null>(null);
  const [phrase, setPhrase] = useState(''); const [consent, setConsent] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState('');
  useEffect(() => { void recovery.discover(); }, [recovery]);
  async function authorize(record?: RecoveryRecord) {
    const me = await api<Student>('users/me');
    if (me.id !== controller.userId) throw new Error('La cuenta activa cambió. Inicia sesión con la cuenta propietaria.');
    const subject = await api<Subject>(`subjects/${subjectId}`); if (subject.id !== subjectId) throw new Error('No se pudo verificar la materia.');
    const documents = await api<Document[]>(`subjects/${subjectId}/documents`);
    const activities = await Promise.all((record?.activities ?? []).map(id => api<Activity>(`activities/${id}`)));
    return { userId: me.id, documents: documents.filter(d => d.status === 'READY'), activities };
  }
  function close() { if (pending) return; setAction(null); setPhrase(''); setConsent(false); setError(''); }
  async function execute(e: React.FormEvent) {
    e.preventDefault(); if (pending) return; setPending(true); setError('');
    try {
      if (action === 'enable') { if (!consent) throw new Error('Autoriza la copia cifrada para habilitarla.'); await recovery.enable(phrase, () => authorize()); }
      else if (action === 'unlock') { if (hasWork(controller.getSnapshot()) && !consent) throw new Error('Confirma que quieres reemplazar el trabajo actual por la copia.'); await recovery.unlock(phrase, authorize, (id, attempt) => api<Evaluation>(`activities/${id}/submissions/${attempt}`)); }
      else await recovery.discard();
      setAction(null); setPhrase(''); setConsent(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar. El trabajo sigue en memoria.'); }
    finally { setPending(false); }
  }
  return <div className="academic-recovery"><p role="status" className={status.mode === 'error' ? 'notice error' : 'hint'}>{status.message}</p><div className="actions">
    {!status.enabled && <button className="button subtle" onClick={() => { setError(''); setAction(status.exists ? 'unlock' : 'enable'); }}>{status.exists ? 'Recuperar copia cifrada' : 'Habilitar recuperación local'}</button>}
    {status.enabled && <><button className="button subtle" onClick={() => { void recovery.flush().catch(() => {}); }}>Guardar copia ahora</button><button className="button subtle" onClick={() => { void recovery.lock().catch(() => {}); }}>Continuar solo en memoria</button></>}
    {status.exists && <button className="button subtle" onClick={() => { setError(''); setAction('discard'); }}>Descartar copia local</button>}
    {status.mode === 'error' && !status.enabled && <button className="button subtle" onClick={() => { void recovery.discover(); }}>Buscar copia de nuevo</button>}
  </div><Dialog open={!!action} title={action === 'discard' ? 'Descartar copia cifrada' : action === 'unlock' ? 'Recuperar el cuaderno' : 'Recuperación local opcional'} onClose={close} busy={pending}>
    <form className="form-stack" onSubmit={execute}>
      {action === 'discard' ? <p>Se eliminará la copia cifrada de esta materia en este navegador. Conservaremos el trabajo que siga en memoria.</p> : <><p>Esta copia permite recuperar tus borradores y respuestas en este navegador durante un máximo de siete días. Usa una frase local distinta de tu contraseña SIARE. No guardamos la frase ni la clave y no podemos recuperarlas.</p><p className="hint">No sincroniza dispositivos ni protege frente a código malicioso (XSS) que ejecute en esta página. Sin copia confirmada, una recarga puede perder el trabajo.</p>
      <div className="field"><label htmlFor="recovery-phrase">Frase local de recuperación</label><input id="recovery-phrase" type="password" autoComplete="off" minLength={12} maxLength={512} required value={phrase} onChange={e => setPhrase(e.target.value)} /></div>
      {action === 'enable' && <label className="review-checkbox"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} />Autorizo una copia local cifrada en este dispositivo.</label>}
      {action === 'unlock' && hasWork(controller.getSnapshot()) && <label className="review-checkbox"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} />Reemplazar el trabajo actual por la copia recuperada.</label>}</>}
      {error && <p role="alert" className="notice error">{error}</p>}<div className="actions"><button className="button primary" type="submit" disabled={pending}>{pending ? 'Comprobando…' : action === 'discard' ? 'Eliminar copia cifrada' : action === 'unlock' ? 'Desbloquear y recuperar' : 'Habilitar copia cifrada'}</button><button className="button secondary" type="button" disabled={pending} onClick={close}>Cancelar</button></div>
    </form></Dialog></div>;
}
