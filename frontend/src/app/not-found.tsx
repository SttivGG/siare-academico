import Link from "next/link";

export default function NotFound() {
  return <main id="contenido" tabIndex={-1} className="error-page"><span className="eyebrow">SIARE · 404</span><h1>No encontramos esta página</h1><p className="muted">Comprueba la dirección o vuelve a tu espacio de aprendizaje.</p><Link className="button primary" href="/inicio">Volver a mi inicio</Link></main>;
}
