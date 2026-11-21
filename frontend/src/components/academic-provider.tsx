"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { AcademicController, hasWork } from '../lib/academic-state';
import { RecoverySession } from '../lib/academic-recovery-session';
import { purgeExpiredRecovery, removeRecovery } from '../lib/academic-recovery';
import { api, type Student } from '../lib/api';
import { Dialog } from './ui/dialog';

type Entry = { controller: AcademicController; recovery: RecoverySession };
type Session = { userId: string; entries: Map<string, Entry>; get: (id: string) => Entry; clear: () => Promise<void> };
const Context = createContext<Session | null>(null);
export function AcademicProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const router = useRouter();
  const [destination, setDestination] = useState<string | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const [session] = useState<Session>(() => {
    const entries = new Map<string, Entry>();
    return { userId, entries, get(id) { let entry = entries.get(id); if (!entry) { const controller = new AcademicController(userId, id); entry = { controller, recovery: new RecoverySession(controller) }; entries.set(id, entry); } return entry; },
      async clear() { channel.current?.postMessage({ type: 'logout', userId }); for (const entry of entries.values()) { entry.controller.destroy(); await entry.recovery.lock().catch(() => {}); } entries.clear(); await removeRecovery(userId); } };
  });
  useEffect(() => {
    void purgeExpiredRecovery().catch(() => {});
    const dispose = () => { for (const entry of session.entries.values()) { entry.controller.destroy(); void entry.recovery.lock().catch(() => {}); } session.entries.clear(); };
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('siare-academic-session');
      channel.current.onmessage = event => { if (event.data?.type === 'logout' && event.data.userId === userId) { dispose(); router.replace('/login'); router.refresh(); } };
    }
    const warn = (event: BeforeUnloadEvent) => { if ([...session.entries.values()].some(e => hasWork(e.controller.getSnapshot()))) event.preventDefault(); };
    const verify = () => { void api<Student>('users/me').then(me => { if (me.id !== userId) { dispose(); router.refresh(); } }).catch(() => { /* A transport failure does not discard live work. A 401 dispatches the expiry event. */ }); };
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.download || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
      const url = new URL(anchor.href);
      const currentSubject = /^\/materias\/([^/]+)$/.exec(location.pathname)?.[1];
      const current = currentSubject ? session.entries.get(currentSubject) : undefined;
      if (url.pathname === location.pathname || !current || !hasWork(current.controller.getSnapshot())) return;
      event.preventDefault(); event.stopPropagation(); setDestination(url.href);
    };
    window.addEventListener('beforeunload', warn); document.addEventListener('click', navigate, true);
    window.addEventListener('siare-session-expired', dispose);
    window.addEventListener('focus', verify);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', navigate, true); window.removeEventListener('siare-session-expired', dispose); window.removeEventListener('focus', verify); channel.current?.close(); dispose(); };
  }, [session, userId, router]);
  return <Context.Provider value={session}>{children}<Dialog open={!!destination} title="Salir del cuaderno" onClose={() => setDestination(null)} actions={<><button className="button primary" onClick={() => { const url = destination!; setDestination(null); if (new URL(url).origin === location.origin) router.push(url); else location.assign(url); }}>Continuar navegación</button><button className="button secondary" onClick={() => setDestination(null)}>Seguir trabajando</button></>}><p>Hay trabajo sin confirmar. Puedes seguir trabajando o salir. Dentro de esta sesión conservamos el cuaderno en memoria; para recargar necesitas una copia cifrada confirmada.</p></Dialog></Context.Provider>;
}
export function useAcademicSession() { return useContext(Context); }
export function useAcademic(subjectId: string) {
  const session = useContext(Context); if (!session) throw new Error('Falta la sesión académica autenticada.');
  const { controller, recovery } = session.get(subjectId);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return { state, controller, recovery };
}
