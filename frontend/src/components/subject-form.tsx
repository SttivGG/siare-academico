"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type Subject } from "../lib/api";
import { Button, Field, TextArea } from "./ui/primitives";

export function SubjectForm({ subject, onSaved }: { subject?: Subject; onSaved?: (subject: Subject) => void }) {
  const router = useRouter();
  const errorRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  const submitting = useRef(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const form = new FormData(event.currentTarget);
    setPending(true); setError(""); setFields({}); setSuccess("");
    try {
      const saved = await api<Subject>(subject ? `subjects/${subject.id}` : "subjects", subject ? "PATCH" : "POST",
        { name: String(form.get("name")), description: String(form.get("description")) || null });
      if (subject) { onSaved?.(saved); setSuccess("Cambios guardados."); }
      else router.push(`/materias/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la materia.");
      if (err instanceof ApiError) setFields(err.fields);
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { submitting.current = false; setPending(false); }
  }
  return <form onSubmit={submit} className="form-stack" aria-busy={pending}>
    {error && <div ref={errorRef} tabIndex={-1} role="alert" className="notice error">{error}</div>}
    {success && <p role="status" className="notice success">{success}</p>}
    <Field label="Nombre de la materia" id="subject-name" name="name" required maxLength={120} defaultValue={subject?.name} placeholder="Por ejemplo, Matemáticas" error={fields.name} onChange={() => setFields(previous => ({ ...previous, name: "" }))} />
    <TextArea label="Descripción (opcional)" id="description" name="description" maxLength={2000} rows={5} defaultValue={subject?.description ?? ""} placeholder="¿Qué vas a estudiar en esta materia?" hint="Hasta 2000 caracteres. Puedes cambiarla más adelante." error={fields.description} onChange={() => setFields(previous => ({ ...previous, description: "" }))} />
    <Button type="submit" busy={pending}>{pending ? "Guardando…" : subject ? "Guardar cambios" : "Crear materia"}</Button>
  </form>;
}
