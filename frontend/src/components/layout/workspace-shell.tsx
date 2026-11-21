import type { ReactNode } from "react";
import { Button } from "../ui/primitives";
import styles from "./shells.module.css";
/** Visual boundary; AcademicProvider owns the authenticated academic controllers. */
export function WorkspaceShell({ children }: { children: ReactNode }) { return <div className={`nexo-workspace ${styles.workspace}`} data-workspace-layout="a">{children}</div>; }

export type WorkspacePanel = "sources" | "learning" | "study";
/** Slots remain mounted at every panel/viewport. Presentation never owns academic state. */
export function WorkspaceColumns({ sources, learning, study, panel, onPanelChange }: { sources: ReactNode; learning: ReactNode; study: ReactNode; panel: WorkspacePanel; onPanelChange: (panel: WorkspacePanel) => void }) {
  return <><nav aria-label="Paneles del cuaderno" className={styles.workspaceNavigation}>{([['sources', 'Fuentes'], ['learning', 'Aprendizaje'], ['study', 'Estudio']] as const).map(([key, label]) => <Button key={key} variant="secondary" aria-pressed={key === panel} onClick={() => onPanelChange(key)}>{label}</Button>)}</nav><div className={styles.workspaceColumns} data-panel={panel}><section aria-label="Fuentes">{sources}</section><section aria-label="Aprendizaje">{learning}</section><section aria-label="Estudio">{study}</section></div></>;
}
