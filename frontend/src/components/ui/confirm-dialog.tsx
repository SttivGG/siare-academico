"use client";

import type { ReactNode } from "react";
import { Dialog } from "./dialog";
import { Button } from "./primitives";

export function ConfirmDialog({ open, title, children, confirmLabel, busy = false, onClose, onConfirm }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; busy?: boolean; onClose: () => void; onConfirm: () => void;
}) {
  return <Dialog open={open} title={title} busy={busy} onClose={onClose} actions={<>
    <Button variant="secondary" autoFocus disabled={busy} onClick={onClose}>Cancelar</Button>
    <Button variant="danger" busy={busy} onClick={onConfirm}>{busy ? "Aplicando…" : confirmLabel}</Button>
  </>}>{children}{busy && <p role="status">Espera mientras se confirma la operación.</p>}</Dialog>;
}
