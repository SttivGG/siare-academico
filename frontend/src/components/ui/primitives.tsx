import { useId, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import styles from "./primitives.module.css";

export function Button({ variant = "primary", busy, className = "", disabled, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "subtle" | "danger"; busy?: boolean }) {
  return <button {...props} type={type} className={`button ${variant} ${className}`} disabled={disabled || busy} aria-busy={busy || undefined} />;
}
export function IconButton({ label, children, ...props }: Omit<Parameters<typeof Button>[0], "children"> & { label: string; children: ReactNode }) {
  return <Button {...props} variant={props.variant ?? "secondary"} className={`${styles.iconButton} ${props.className ?? ""}`} aria-label={label}>{children}</Button>;
}
export function ProviderButton(props: ButtonHTMLAttributes<HTMLButtonElement>) { return <Button {...props} type="button" variant="secondary" className={`full ${props.className ?? ""}`} />; }
export function Field({ label, error, hint, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const generated = useId(); const fieldId = id ?? generated;
  const description = [props["aria-describedby"], hint && `${fieldId}-hint`, error && `${fieldId}-error`].filter(Boolean).join(" ") || undefined;
  return <div className="field"><label htmlFor={fieldId}>{label}</label>{hint && <span className="hint" id={`${fieldId}-hint`}>{hint}</span>}<input {...props} id={fieldId} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={description} />{error && <span className="field-error" id={`${fieldId}-error`}>{error}</span>}</div>;
}
export function Select({ label, id, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const generated = useId(); const fieldId = id ?? generated;
  return <div className="field"><label htmlFor={fieldId}>{label}</label><select {...props} id={fieldId}>{children}</select></div>;
}
export function Surface({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) { return <div {...props} className={`${styles.surface} ${className}`} />; }
export function Notice({ tone = "info", className = "", ...props }: HTMLAttributes<HTMLDivElement> & { tone?: "info" | "success" | "warning" | "error" }) {
  return <div role={tone === "error" ? "alert" : "status"} {...props} className={`notice ${tone} ${className}`} />;
}
export function StatusBadge(props: HTMLAttributes<HTMLSpanElement>) { return <span {...props} className={`badge ${props.className ?? ""}`} />; }
export function LoadingState({ children = "Cargando…" }: { children?: ReactNode }) { return <p role="status" className={styles.loading}>{children}</p>; }
export function EmptyState({ title, children }: { title: string; children: ReactNode }) { return <section className="empty-state"><h2>{title}</h2>{children}</section>; }
export function Progress({ label, value, max = 100 }: { label: string; value?: number; max?: number }) { return <label className="field">{label}<progress value={value} max={max} /></label>; }
