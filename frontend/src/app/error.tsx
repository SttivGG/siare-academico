"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="contenido" tabIndex={-1} className="error-page"><span className="eyebrow">SIARE</span><h1>No pudimos cargar este espacio</h1><p className="muted" role="alert">El servicio puede estar temporalmente ocupado. Inténtalo de nuevo en unos segundos.</p><div className="actions"><button className="button primary" onClick={reset}>Volver a intentar</button><Link className="button secondary" href="/login">Ir a iniciar sesión</Link></div></main>;
}
