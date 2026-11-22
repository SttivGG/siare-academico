"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./primitives";
import styles from "./dialog.module.css";

/** The caller owns the mutation and pending state. Cancel never invokes it. */
export function Dialog({ open, title, children, actions, busy = false, onClose }: { open: boolean; title: string; children: ReactNode; actions?: ReactNode; busy?: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null); const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} {...{ closedby: busy ? "none" : "closerequest" }} className={styles.dialog} aria-labelledby={titleId} aria-busy={busy} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClose={() => { if (open && !busy) onClose(); }}>
    <h2 id={titleId}>{title}</h2>{children}<div className="actions">{actions ?? <Button variant="secondary" disabled={busy} onClick={onClose}>Cerrar</Button>}</div>
  </dialog>;
}
