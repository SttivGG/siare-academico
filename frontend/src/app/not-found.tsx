import Link from "next/link";
import { FeedbackShell } from "../components/layout/feedback-shell";

export default function NotFound() {
  return <FeedbackShell title="No encontramos esta página" code="404"><p className="muted">Comprueba la dirección o vuelve a tu espacio de aprendizaje.</p><Link className="button primary" href="/inicio">Volver a mi inicio</Link></FeedbackShell>;
}
