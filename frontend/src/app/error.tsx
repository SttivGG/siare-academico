"use client";

import Link from "next/link";
import { FeedbackShell } from "../components/layout/feedback-shell";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <FeedbackShell title="No pudimos cargar este espacio"><p className="muted" role="alert">El servicio puede estar temporalmente ocupado. Inténtalo de nuevo en unos segundos.</p><div className="actions"><button className="button primary" onClick={reset}>Volver a intentar</button><Link className="button secondary" href="/login">Ir a iniciar sesión</Link></div></FeedbackShell>;
}
