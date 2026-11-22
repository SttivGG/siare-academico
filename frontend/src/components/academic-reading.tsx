"use client";
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { DocumentSource, Fragment } from '../lib/activities';
const warningLabels: Record<string, string> = { PROVENANCE_UNVERIFIED: 'Este documento contiene credenciales C2PA. Su firma y procedencia no han sido verificadas.', OCR_APPLIED: 'Se aplicó reconocimiento OCR. El texto puede contener errores.', ASSOCIATED_FILES_IGNORED: 'Los archivos asociados se conservan en el original y se omiten en la lectura.' };
export function AcademicReading({ document }: { document: DocumentSource | null }) {
  const [text, setText] = useState<{ fragments: Fragment[]; warnings: string[] } | null>(null);
  const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; setText(null); setError(''); if (document) api<{ fragments: Fragment[]; warnings: string[] }>(`documents/${document.documentId}/text`).then(value => { if (active) setText(value); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [document?.documentId, retry]);
  return <article className="academic-reading" aria-label="Lectura académica"><h3>{document?.originalFilename ?? 'Lectura académica'}</h3>{!document && <p className="notice">Selecciona una fuente READY en Fuentes para comenzar la lectura.</p>}{document && !text && !error && <p role="status">Cargando lectura…</p>}{error && <p role="alert" className="notice error">{error}<button className="button secondary" onClick={() => setRetry(retry + 1)}>Reintentar lectura</button></p>}{text?.warnings.map((w, i) => <p className="notice warning" key={i}>{warningLabels[w] ?? 'El documento se procesó con advertencias.'}</p>)}{text?.fragments.map(f => <section key={f.index}><h4>{f.unitType === 'page' ? 'Página' : 'Unidad'} {f.unitNumber} · Fragmento {f.index}</h4><p className="preserve-lines">{f.text}</p></section>)}</article>;
}
