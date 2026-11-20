"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/primitives";
import { Icon } from "./ui/icon";
import { ThemeControl } from "./ui/theme-control";
import styles from "./layout/navigation.module.css";

export function StudentNav({ role = "USER", user }: { role?: string; user: { name: string; email: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const header = useRef<HTMLElement>(null);
  const links = [{ href: "/inicio", label: "Inicio", icon: "home" }, { href: "/materias", label: "Mis materias", icon: "book" }, { href: "/sesiones", label: "Sesiones", icon: "sessions" }, { href: "/seguridad", label: "Seguridad", icon: "shield" }, ...(["ADMIN", "SUPERADMIN"].includes(role) ? [{ href: "/administracion", label: "Administración", icon: "admin" }] : [])];
  const active = (href: string) => pathname === href || href === "/materias" && pathname.startsWith("/materias/");
  const current = pathname === "/materias/nueva" ? "Crear materia" : pathname.startsWith("/materias/") ? "Espacio de estudio" : links.find(link => active(link.href))?.label ?? "Mi espacio";
  function exclusive(event: SyntheticEvent<HTMLDetailsElement>) {
    const opened = event.currentTarget;
    if (opened.open) header.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(detail => { if (detail !== opened) detail.open = false; });
  }
  useEffect(() => { header.current?.querySelectorAll("details[open]").forEach(el => el.removeAttribute("open")); }, [pathname]);
  useEffect(() => {
    const close = (event: PointerEvent | KeyboardEvent) => {
      header.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(detail => {
        if (event instanceof KeyboardEvent && event.key === "Escape") { detail.open = false; detail.querySelector("summary")?.focus(); }
        else if (event instanceof PointerEvent && !detail.contains(event.target as Node)) detail.open = false;
      });
    };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, []);
  async function logout() {
    if (submitting.current) return; submitting.current = true;
    setPending(true); setError("");
    try { await api("auth/logout", "POST"); router.replace("/login"); router.refresh(); }
    catch { setError("No se pudo cerrar la sesión. Inténtalo de nuevo."); }
    finally { submitting.current = false; setPending(false); }
  }
  const navigation = (mobile = false) => <nav aria-label={mobile ? "Navegación móvil" : "Navegación principal"} className={mobile ? styles.mobileLinks : styles.railLinks}>{links.map(link => <Link key={link.href} href={link.href} aria-current={active(link.href) ? "page" : undefined} className={styles.navLink}><Icon name={link.icon as Parameters<typeof Icon>[0]["name"]} /><span>{link.label}</span></Link>)}</nav>;
  return <><aside className={styles.rail}><Link href="/inicio" className={styles.monogram} aria-label="SIARE · Inicio">S</Link>{navigation()}<span className={styles.railCaption}>SIARE</span></aside>
    <header ref={header} className={styles.header}>
      <details className={styles.mobileMenu} onToggle={exclusive}><summary aria-label="Abrir navegación"><Icon name="menu" /></summary><div className={styles.menu}>{navigation(true)}</div></details>
      <nav aria-label="Ruta actual" className={styles.breadcrumbs}><Link href="/inicio">Mi espacio</Link>{pathname !== "/inicio" && <><Icon name="arrow" />{pathname.startsWith("/materias/") && <><Link href="/materias">Mis materias</Link><Icon name="arrow" /></>}<span aria-current="page">{current}</span></>}</nav>
      <div className={styles.headerActions}><details onToggle={exclusive}><summary className={styles.themeSummary}>Tema</summary><div className={styles.menu}><ThemeControl /></div></details>
        <details onToggle={exclusive}><summary aria-label="Menú de cuenta" className={styles.avatar}><Icon name="account" /></summary><div className={styles.menu}><strong>{user.name}</strong><p className="hint identity-id">{user.email}</p><Link href="/seguridad">Cuenta y seguridad</Link><Link href="/sesiones">Mis sesiones</Link><Button variant="subtle" busy={pending} onClick={logout}>{pending ? "Cerrando…" : "Cerrar sesión"}</Button></div></details></div>
      {error && <p role="alert" className={`notice error ${styles.logoutError}`}>{error}</p>}
    </header></>;
}
