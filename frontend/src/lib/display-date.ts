/** Identity dates are supplied by the server. An absent/invalid value is never a made-up date. */
export function displayDate(value: string | null | undefined, dateOnly = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", ...(dateOnly ? {} : { timeStyle: "short" }) }).format(new Date(value));
}
