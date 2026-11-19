# Propuesta para revisión con el responsable de ML

Estado: **dependencia pendiente, sin endpoint implementado ni acuerdo del responsable**.
H4 permite editar/importar bancos revisados; no convierte prosa en preguntas. Este
documento propone el contrato de esa capacidad para que el integrante 3 lo revise
en su rama. No modifica `services/content-ai/` ni el contrato de extracción.

El contrato de recomendaciones de `CONTRATOS_EQUIPO.md` es otra capacidad. Generar
contenido educativo necesita un acuerdo propio antes de implementar transporte.

## Responsabilidades y flujo propuesto

1. El estudiante selecciona un documento READY y fragmentos concretos. Spring
   comprueba propiedad, materia activa, estado y versión de la extracción.
2. Spring envía únicamente los fragmentos autorizados seleccionados al servicio
   interno de ML. El navegador no recibe credenciales de servicio ni accede a ML.
3. ML devuelve un borrador `ActivityBank` con `validated:false`, referencias,
   índices y citas literales. No crea actividades ni evalúa intentos.
4. Spring valida el borrador contra los límites de `ActivityBank`, comprueba las
   citas frente a la misma extracción y devuelve advertencias al estudiante.
5. El estudiante corrige contenido, opciones, claves, explicaciones y evidencia.
   Solo una revisión explícita habilita publicar con `validated:true` mediante
   el POST H3 existente. Spring repite todas las comprobaciones y genera la actividad.

## Solicitud interna propuesta

`POST /internal/v1/activity-bank-drafts` (nombre sujeto a acuerdo), autenticación
de servicio independiente, `X-Request-Id`, sin JWT del estudiante. No habilitar
esta ruta en el BFF actual. Propuesta de cuerpo:

```json
{
  "schemaVersion": 1,
  "requestId": "UUID",
  "documentId": "UUID",
  "extractionVersion": "identificador-inmutable-a-acordar",
  "type": "QUIZ",
  "topic": "tema exacto",
  "count": 5,
  "language": "es",
  "fragments": [
    { "index": 0, "reference": "Página 1", "unitType": "page", "unitNumber": 1, "text": "Texto autorizado" }
  ]
}
```

Propuesta inicial de límites para discutir: 32 fragmentos, 100 000 caracteres
totales, 512 KiB de solicitud, 30 segundos de presupuesto y concurrencia acotada.
La versión de extracción todavía no existe en la API pública; se debe acordar
una huella/versión estable antes de admitir borradores que sobrevivan reprocesamientos.
Spring vuelve a leer el texto al publicar y rechaza evidencia obsoleta.

## Respuesta propuesta

```json
{
  "schemaVersion": 1,
  "requestId": "UUID",
  "status": "DRAFT",
  "extractionVersion": "misma-version",
  "generatorVersion": "modelo-y-plantilla-versionados",
  "bank": { "validated": false, "questions": [], "words": [] },
  "warnings": [],
  "quality": { "requiresHumanReview": true, "checks": [] }
}
```

Las listas vacías de este esquema son ilustrativas; una respuesta DRAFT exitosa
debe contener la cantidad solicitada y referencias verificables en cada entrada.
Un borrador no puede publicarse directamente como `ActivityBank` H3: el editor
completa la revisión humana. No usar un porcentaje inventado de confianza como
prueba de calidad ni como calificación del estudiante.

Quiz: IDs estables únicos de 1–64 caracteres `[A-Za-z0-9_-]`, hasta 50 preguntas,
enunciado ≤2000, tema ≤100, explicación ≤2000, 2–6 opciones distintas con texto
≤1000 y una sola clave existente. Crucigrama: hasta 12 palabras, respuesta original
≤100 que normalice a 2–25 letras A–Z/Ñ, pistas ≤2000 y tema ≤100. Fuente: referencia
≤500, índice 0–1999 y cita ≤4000. Con documento, **cada entrada** necesita una cita
literal que exista en su fragmento y contenga la respuesta correcta normalizada.
No devolver claves, citas o explicaciones en la proyección pública para resolver.

## Calidad y fallos

El responsable de ML debe acordar criterios y fixtures para: fidelidad al
material, pregunta inequívoca, distractores plausibles pero incorrectos, explicación
respaldada, ausencia de duplicados, cobertura del tema, citas suficientes y manejo
de texto OCR deficiente. El contenido del documento es dato no confiable; las
instrucciones presentes en él no deben modificar las reglas del generador.

| Estado/código propuesto | Comportamiento |
| --- | --- |
| 400 `INVALID_DRAFT_REQUEST` | Fragmentos, parámetros o versión inválidos. Corregir selección. |
| 409 `EXTRACTION_CHANGED` | Volver a seleccionar fragmentos de la extracción vigente. |
| 422 `INSUFFICIENT_CONTENT` | No hay evidencia suficiente para cantidad/tema; no rellenar con invenciones. |
| 422 `CONTENT_QUALITY_FAILED` | No se logra un banco válido y fundamentado; devolver motivos por entrada. |
| 429 `GENERATOR_BUSY` | Espera indicada por Retry-After; sin bucles automáticos ilimitados. |
| 503 `GENERATOR_UNAVAILABLE` | Conservar selección y permitir reintento explícito. |
| 504 `GENERATION_TIMEOUT` | Conservar borrador previo; no presentar éxito parcial como banco completo. |

Los errores deben incluir requestId, código y mensaje seguro, sin texto privado,
credenciales ni trazas del proveedor. Si solo parte del material sirve, devolver
insuficiencia con cantidad disponible y permitir que el estudiante reduzca count.
No crear actividades automáticamente. Las pruebas deben incluir documento vacío,
tema ausente, citas inventadas, respuesta no contenida en cita, OCR ilegible, Ñ,
duplicados, opciones ambiguas, timeout, saturación y reprocesamiento concurrente.

Pendiente de acuerdo: nombre de ruta, autenticación, límites/presupuesto definitivos,
versionado, política de datos, evaluación de calidad, fixtures compartidas y
aceptación explícita del integrante 3. Este PR no acredita coordinación ya realizada.
