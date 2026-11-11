"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { DEFAULT_MAX_BYTES, uploadError } from "../lib/document-policy";

type Document = { documentId: string; originalFilename: string; contentType: string; sizeBytes: number; createdAt: string;
  status: "UPLOADED" | "PROCESSING" | "READY" | "FAILED"; errorCode: string | null; leaseUntil: string | null };
type Text = { fragments: { index: number; unitType: string; unitNumber: number; text: string }[]; warnings: string[] };
const labels = { UPLOADED: "Cargado", PROCESSING: "Procesando", READY: "Texto disponible", FAILED: "Procesamiento fallido" };
const unitLabels: Record<string, string> = { page: "Página", slide: "Diapositiva", section: "Sección", image: "Imagen" };
const errors: Record<string, string> = { NO_EXTRACTABLE_TEXT: "No se encontró texto reconocible. Los PDF escaneados necesitan una versión con texto seleccionable.",
  PROCESSOR_UNAVAILABLE: "El procesador no está disponible. El original se conserva; puedes reintentar.",
  EXTRACTION_TIMEOUT: "Se agotó el tiempo de extracción. Prueba con un documento más pequeño.",
  OCR_UNAVAILABLE: "El reconocimiento de imágenes no está disponible. Puedes reintentar más tarde.",
  UNSAFE_DOCUMENT: "El archivo excede los límites de procesamiento o contiene contenido no permitido." };

export function SubjectDocuments({ subjectId, archived }: { subjectId: string; archived: boolean }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [maximum, setMaximum] = useState(DEFAULT_MAX_BYTES);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ id: string; text: Text } | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  const refresh = useCallback(async () => {
    try { setDocuments(await api<Document[]>(`subjects/${subjectId}/documents`)); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo consultar la lista."); }
    finally { setLoading(false); }
  }, [subjectId]);
  useEffect(() => { void refresh(); fetch("/api/files/limits", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => { if (data?.maxBytes > 0) setMaximum(data.maxBytes); }).catch(() => {}); }, [refresh]);
  useEffect(() => {
    if (!documents.some(d => d.status === "PROCESSING")) return;
    const interval = setInterval(() => { void refresh(); }, 2500);
    return () => clearInterval(interval);
  }, [documents, refresh]);
  function fail(message: string) { setError(message); requestAnimationFrame(() => alert.current?.focus()); }
  function select(selected: File | null) {
    setNotice(""); setError("");
    if (!selected) { setFile(null); return; }
    const problem = uploadError(selected, maximum);
    if (problem) { setFile(null); if (input.current) input.current.value = ""; fail(problem); return; }
    setFile(selected);
  }
  async function upload(event: React.FormEvent) {
    event.preventDefault(); if (!file) { fail("Selecciona un archivo para continuar."); return; }
    const problem = uploadError(file, maximum); if (problem) { fail(problem); return; }
    setBusy("upload"); setError(""); setNotice(""); setProgress(0);
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/files/subjects/${subjectId}/documents`); xhr.setRequestHeader("X-SIARE-CSRF", "1"); xhr.timeout = 60_000;
        xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round(e.loaded * 100 / e.total)); };
        xhr.onload = () => {
          if (xhr.status === 401) window.location.assign("/login?sesion=expirada");
          let data; try { data = JSON.parse(xhr.responseText); } catch { reject(new Error("No se pudo cargar el documento.")); return; }
          if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new Error(data.message ?? "No se pudo cargar el documento."));
        };
        xhr.onerror = () => reject(new Error("No se pudo conectar. Vuelve a intentarlo."));
        xhr.ontimeout = () => reject(new Error("La carga tardó demasiado. Vuelve a intentarlo."));
        const body = new FormData(); body.append("file", file); xhr.send(body);
      });
      setFile(null); if (input.current) input.current.value = "";
      setNotice("Archivo guardado. Pulsa Procesar para extraer su texto."); await refresh();
    } catch (err) { fail(err instanceof Error ? err.message : "No se pudo cargar el documento."); }
    finally { setBusy(""); setProgress(null); }
  }
  async function process(document: Document) {
    setBusy(document.documentId); setError(""); setNotice("");
    try { await api(`documents/${document.documentId}/process`, "POST"); await refresh(); }
    catch (err) { fail(err instanceof Error ? err.message : "No se pudo solicitar el procesamiento."); }
    finally { setBusy(""); }
  }
  async function showText(document: Document) {
    if (preview?.id === document.documentId) { setPreview(null); return; }
    setBusy(document.documentId); setError("");
    try { setPreview({ id: document.documentId, text: await api<Text>(`documents/${document.documentId}/text`) }); }
    catch (err) { fail(err instanceof Error ? err.message : "No se pudo consultar el texto."); }
    finally { setBusy(""); }
  }
  return <section className="panel document-panel" aria-labelledby="documents-title"><h2 id="documents-title">Documentos de la materia</h2>
    <p className="muted section-intro">Guarda tus apuntes y extrae su texto para consultarlo aquí.</p>
    {error && <p className="notice error" role="alert" tabIndex={-1} ref={alert}>{error}</p>}
    {notice && <p className="notice success" role="status">{notice}</p>}
    {archived ? <p className="notice">La materia está archivada. Sus documentos y textos siguen disponibles para consulta y descarga.</p>
      : <form onSubmit={upload} className="document-upload" aria-busy={busy === "upload"}>
        <div className={`document-drop${dragging ? " dragging" : ""}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); if (busy) return; if (e.dataTransfer.files.length !== 1) { fail("Selecciona un solo archivo cada vez."); return; } select(e.dataTransfer.files[0]); }}>
          <label htmlFor="document-file">Seleccionar documento</label>
          <p className="hint" id="file-hint">PDF, DOCX, PPTX, JPG, JPEG o PNG · Máximo {Math.round(maximum / 1024 / 1024)} MiB. También puedes arrastrar un archivo aquí.</p>
          <input ref={input} id="document-file" type="file" accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png" aria-describedby="file-hint" disabled={!!busy} onChange={e => select(e.target.files?.[0] ?? null)} />
          {file && <p className="preserve-lines">Seleccionado: {file.name}</p>}
        </div><div className="actions"><button className="button primary" type="submit" disabled={!!busy || !file}>{busy === "upload" ? "Guardando archivo…" : "Subir documento"}</button>
          {progress !== null && <span role="status">{progress < 100 ? `Cargando ${progress}%` : "Validando y guardando…"}</span>}</div>
        {progress !== null && <progress aria-label="Progreso de carga" max={100} value={progress} />}
      </form>}
    <div className="document-toolbar"><h3>Archivos ({documents.length})</h3><button className="button subtle" type="button" disabled={!!busy} onClick={() => { setError(""); void refresh(); }}>Actualizar lista</button></div>
    {loading ? <p role="status">Cargando documentos…</p> : documents.length === 0 ? <p className="notice">Todavía no hay documentos en esta materia.</p> : <ul className="document-list">{documents.map(document => {
      const expired = document.status === "PROCESSING" && document.leaseUntil && Date.parse(document.leaseUntil) <= Date.now();
      return <li key={document.documentId}><h3>{document.originalFilename}</h3><p className="hint">{document.originalFilename.split(".").at(-1)?.toUpperCase()} · {(document.sizeBytes / 1024).toLocaleString("es-CO", { maximumFractionDigits: 1 })} KiB · {new Date(document.createdAt).toLocaleDateString("es-CO")}</p>
        <p className="document-status" role="status">{labels[document.status]}{expired ? " · El trabajo se interrumpió; puedes reintentar." : ""}</p>
        {document.status === "FAILED" && <p className="notice error">{errors[document.errorCode ?? ""] ?? "No se pudo extraer el texto. El original se conserva y puedes reintentar."}</p>}
        <div className="actions"><a className="button secondary" href={`/api/files/documents/${document.documentId}/download`}>Descargar<span className="sr-only"> {document.originalFilename}</span></a>
          {!archived && (document.status === "UPLOADED" || document.status === "FAILED" || expired) && <button className="button secondary" disabled={!!busy} onClick={() => void process(document)}>{busy === document.documentId ? "Solicitando…" : document.status === "UPLOADED" ? "Procesar" : "Reintentar procesamiento"}</button>}
          {document.status === "READY" && <button className="button secondary" disabled={!!busy} aria-expanded={preview?.id === document.documentId} onClick={() => void showText(document)}>{preview?.id === document.documentId ? "Ocultar texto" : "Ver texto"}</button>}</div>
        {preview?.id === document.documentId && <div className="document-preview" role="region" tabIndex={0} aria-label={`Texto de ${document.originalFilename}`}>
          {preview.text.warnings.map((warning, i) => <p className="notice" key={i}>{warning}</p>)}
          {preview.text.fragments.map(fragment => <section key={fragment.index}><h4>{unitLabels[fragment.unitType] ?? "Sección"} {fragment.unitNumber}</h4><p className="preserve-lines">{fragment.text}</p></section>)}
        </div>}
      </li>;
    })}</ul>}
  </section>;
}
