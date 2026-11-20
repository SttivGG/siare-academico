"use client";

import Link from "next/link";
import { FeedbackShell } from "../components/layout/feedback-shell";
import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { Button } from "../components/ui/primitives";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const router = useRouter();
  return <FeedbackShell title="No pudimos cargar este espacio"><p className="muted" role="alert">El servicio puede estar temporalmente ocupado. Inténtalo de nuevo en unos segundos.</p><div className="actions"><Button onClick={() => startTransition(() => { router.refresh(); reset(); })}>Volver a intentar</Button><Link className="button secondary" href="/login">Ir a iniciar sesión</Link></div></FeedbackShell>;
}
