"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../lib/api";

export function StudentNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setPending(true); setError("");
    try { await api("auth/logout", "POST"); router.replace("/login"); router.refresh(); }
    catch { setError("No se pudo cerrar la sesión. Inténtalo de nuevo."); }
    finally { setPending(false); }
  }
  return <><nav aria-label="Navegación principal" className="student-nav">
    <Link className="brand" href="/inicio">SIARE<span className="brand-caption">Mi espacio de aprendizaje</span></Link>
    <div className="nav-links"><Link href="/inicio" aria-current={pathname === "/inicio" ? "page" : undefined}>Inicio</Link>
      <Link href="/materias" aria-current={pathname.startsWith("/materias") ? "page" : undefined}>Mis materias</Link>
      <button type="button" className="button subtle" onClick={logout} disabled={pending}>{pending ? "Cerrando…" : "Cerrar sesión"}</button></div>
  </nav>{error && <p role="alert" className="notice error">{error}</p>}</>;
}
