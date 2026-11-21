"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAppearance, setAppearance } from "../lib/appearance-store";
import { Button } from "./ui/primitives";
import { Icon } from "./ui/icon";
import { ThemeControl } from "./ui/theme-control";
import styles from "./layout/navigation.module.css";
import { useAcademicSession } from "./academic-provider";

export function StudentNav({ role = "USER", user }: { role?: string; user: { name: string; email: string } }) {
  const pathname = usePathname(), router = useRouter(), academic = useAcademicSession();
  const { appearance: { expanded } } = useAppearance();
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const submitting = useRef(false), rail = useRef<HTMLElement>(null);
  const account = useRef<HTMLDetailsElement>(null), accountTrigger = useRef<HTMLElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const railId = useId();
  const links = [{ href: "/inicio", label: "Inicio", icon: "home" }, { href: "/materias", label: "Mis materias", icon: "book" }, { href: "/sesiones", label: "Sesiones", icon: "sessions" }, { href: "/seguridad", label: "Seguridad", icon: "shield" }, ...(["ADMIN", "SUPERADMIN"].includes(role) ? [{ href: "/administracion", label: "Administración", icon: "admin" }] : [])];
  const active = (href: string) => pathname === href || href === "/materias" && pathname.startsWith("/materias/");
  const current = pathname === "/configuracion/apariencia" ? "Apariencia" : pathname === "/materias/nueva" ? "Crear materia" : pathname.startsWith("/materias/") ? "Espacio de estudio" : links.find(link => active(link.href))?.label ?? "Mi espacio";
  useEffect(() => { if (account.current) account.current.open = false; setMobileOpen(false); }, [pathname]);
  useEffect(() => { if (mobileOpen) rail.current?.querySelector<HTMLElement>("nav a")?.focus(); }, [mobileOpen]);
  useEffect(() => {
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        if (account.current?.open) { account.current.open = false; accountTrigger.current?.focus(); }
        else if (rail.current?.contains(document.activeElement) || document.activeElement === mobileTrigger.current) { setMobileOpen(false); if (matchMedia("(max-width: 700px)").matches) mobileTrigger.current?.focus(); }
      } else {
        if (account.current?.open && !account.current.contains(event.target as Node)) account.current.open = false;
        if (!rail.current?.contains(event.target as Node) && !mobileTrigger.current?.contains(event.target as Node)) setMobileOpen(false);
      }
    };
    const leave = (event: FocusEvent) => {
      if (account.current?.open && !account.current.contains(event.target as Node)) account.current.open = false;
      if (!rail.current?.contains(event.target as Node) && event.target !== mobileTrigger.current) setMobileOpen(false);
    };
    const desktop = matchMedia("(min-width: 701px)");
    const resize = () => {
      setMobileOpen(false);
      if (account.current) account.current.open = false;
      if (!desktop.matches && rail.current?.contains(document.activeElement)) mobileTrigger.current?.focus();
      else if (desktop.matches && document.activeElement === mobileTrigger.current) accountTrigger.current?.focus();
    };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", close); document.addEventListener("focusin", leave); desktop.addEventListener("change", resize);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); document.removeEventListener("focusin", leave); desktop.removeEventListener("change", resize); };
  }, []);
  async function logout() {
    if (submitting.current) return; submitting.current = true;
    setPending(true); setError("");
    try { await api("auth/logout", "POST"); let cleared = true; try { await academic?.clear(); } catch { cleared = false; } router.replace(cleared ? "/login" : "/login?copia=error-al-eliminar"); router.refresh(); }
    catch { setError("No se pudo cerrar la sesión. Inténtalo de nuevo."); }
    finally { submitting.current = false; setPending(false); }
  }
  return <>
    <aside ref={rail} id={railId} aria-label="Barra de navegación" className={styles.rail} data-mobile-open={mobileOpen}>
      <Link href="/inicio" className={styles.brand} aria-label="SIARE · Inicio"><span className={styles.monogram}>S</span><span className={styles.railLabel}>SIARE <small>Académico</small></span></Link>
      <button type="button" className={styles.collapse} aria-label={expanded ? "Contraer navegación" : "Expandir navegación"} aria-expanded={expanded} aria-controls={railId} title={expanded ? "Contraer navegación" : "Expandir navegación"} onClick={() => setAppearance({ expanded: !expanded })}><Icon name="menu" /><span className={styles.railLabel}>Contraer barra</span></button>
      <nav aria-label="Navegación principal" className={styles.railLinks}>{links.map(link => <Link key={link.href} href={link.href} title={link.label} aria-label={link.label} aria-current={active(link.href) ? "page" : undefined} className={styles.navLink}><Icon name={link.icon as Parameters<typeof Icon>[0]["name"]} /><span className={styles.railLabel}>{link.label}</span></Link>)}</nav>
      <details ref={account} className={styles.account}>
        <summary ref={accountTrigger} aria-label="Menú de cuenta" title="Menú de cuenta" className={styles.accountTrigger}><span className={styles.avatar}><Icon name="account" /></span><span className={styles.railLabel}><strong>{user.name}</strong><small>Mi cuenta</small></span></summary>
        <div className={styles.accountMenu}><strong>{user.name}</strong><p className="hint identity-id">{user.email}</p><Link href="/seguridad"><Icon name="shield" />Cuenta y seguridad</Link><Link href="/sesiones"><Icon name="sessions" />Mis sesiones</Link><Link href="/configuracion/apariencia"><Icon name="appearance" />Apariencia</Link><Button variant="subtle" busy={pending} onClick={logout}>{pending ? "Cerrando…" : "Cerrar sesión"}</Button>{error && <p role="alert" className="notice error">{error}</p>}</div>
      </details>
    </aside>
    <header className={styles.header}>
      <button ref={mobileTrigger} type="button" aria-label="Abrir navegación" aria-expanded={mobileOpen} aria-controls={railId} className={styles.mobileTrigger} onClick={() => setMobileOpen(!mobileOpen)}><Icon name="menu" /></button>
      <nav aria-label="Ruta actual" className={styles.breadcrumbs}><Link href="/inicio">Mi espacio</Link>{pathname !== "/inicio" && <><Icon name="arrow" />{pathname.startsWith("/materias/") && <><Link href="/materias">Mis materias</Link><Icon name="arrow" /></>}<span aria-current="page">{current}</span></>}</nav>
      <div className={styles.headerActions}><ThemeControl compact /></div>
    </header>
  </>;
}
