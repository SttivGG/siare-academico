# Contrato H5 v1: borradores académicos

Estado: propuesta concreta del consumidor, pendiente de conformidad del integrante
ML. Complementa H4 y sustituye su nombre de campo `bank` por `draft`, de tipo
`ActivityBankDraft`. No modifica [OpenAPI de producción](openapi.json), el contrato
de extracción ni el constructor de `ActivityBank` H3.

Archivos normativos propuestos: [JSON Schema](contracts/h5/activity-draft.schema.json),
[OpenAPI interno](contracts/h5/openapi.proposed.json) y [fixtures/suite](contracts/h5/README.md).
Los esquemas usan JSON Schema 2020-12, compatible con el dialecto de
[OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0.html).

## Transporte interno

`POST http://content-ai:5000/internal/v1/activity-bank-drafts`. Respuesta síncrona
200 únicamente con un borrador completo de la cantidad solicitada. Sin endpoint
público Python, URL de documento, archivo, GridFS, studentId o permisos delegados.

| Cabecera | Regla propuesta |
| --- | --- |
| Authorization | Bearer de servicio `ACTIVITY_GENERATION_SERVICE_TOKEN`, independiente del token de extracción y de los JWT de usuario; mínimo 32 bytes aleatorios, provisión y rotación coordinadas |
| Content-Type / Accept | `application/json`; JSON UTF-8 estricto, sin coerción de tipos, claves duplicadas ni valores no finitos |
| X-Request-Id | UUID canónico en minúsculas, igual al requestId del cuerpo y eco de respuesta |
| Cache-Control | `no-store` en respuestas, incluidos errores |

El token autentica a Spring, no al alumno. Un 401/403 interno se registra como
fallo de integración y se convierte en 503 seguro para el cliente público. El
BFF no debe permitir `/internal/*`. La red Docker actual no sustituye autenticación;
antes de salir de la red privada se deberá acordar TLS autenticado.

`requestId` correlaciona una ejecución, no promete idempotencia durable. No hay
reintentos automáticos de este POST. Un reintento explícito genera un requestId
nuevo y puede producir otro borrador. La idempotencia de publicación vive en
Spring y es independiente de esta operación.

## Solicitud y respuesta

Los ejemplos completos están en [quiz-request.json](contracts/h5/fixtures/quiz-request.json),
[quiz-response.json](contracts/h5/fixtures/quiz-response.json),
[crossword-request.json](contracts/h5/fixtures/crossword-request.json) y
[crossword-response.json](contracts/h5/fixtures/crossword-response.json).
Todos contienen hechos sintéticos para pruebas de contrato.

```json
{
  "schemaVersion": 1,
  "requestId": "00000000-0000-4000-8000-000000000001",
  "documentId": "00000000-0000-4000-8000-000000000002",
  "extractionVersion": "operation:00000000-0000-4000-8000-000000000003",
  "type": "QUIZ",
  "topic": "Astronomía",
  "count": 1,
  "gridSize": 15,
  "language": "es",
  "extractionWarnings": [],
  "fragments": [{
    "index": 0, "reference": "Página 1", "unitType": "page", "unitNumber": 1,
    "text": "El Sol es la estrella del sistema solar."
  }]
}
```

Spring construye referencias canónicas: `Página N`, `Diapositiva N`, `Sección N`
o `Imagen N`. Los índices son los originales de la extracción, desde cero; no se
renumeran al seleccionar un subconjunto. Las unidades comienzan en uno. Ordenar
fragmentos por índice ascendente, sin duplicados. Python conserva literalmente
tema, versión y referencias; Spring compara los ecos con su petición.

La respuesta 200 contiene `schemaVersion`, `requestId`, `documentId`,
`extractionVersion`, `generatorVersion`, `status:DRAFT`, `type`, `topic`, `count`,
`draft`, `warnings` y `quality`. `draft.validated` es siempre **false**. Solo QUIZ
usa `questions` y solo CROSSWORD usa `words`; la otra lista está vacía. No retornar
actividad, cuadrícula, puntuación ni un banco H3 validado.

Quiz incluye opciones con IDs estables, una clave existente y explicación apoyada
en la fuente. Crucigrama incluye respuesta, pista y explicación fundamentada;
esta última se conserva en la revisión privada porque `ActivityBank.Word` H3 no
tiene ese campo. Su feedback actual usa la pista, y H5 no cambia esa semántica.

Cada ítem incluye `source:{reference,fragmentIndex,unitType,unitNumber,quote}`.
La cita debe aparecer literalmente en el fragmento seleccionado y contener la
respuesta correcta tras la normalización H3, que no puede quedar vacía.
Referencia y unidad deben coincidir.
La misma cita debe sustentar la explicación; si no basta, reformular o rechazar
el ítem. V1 usa una fuente por ítem, compatible con H3; preguntas que requieren
evidencia repartida entre fragmentos se rechazan o reformulan.

`quality.requiresHumanReview` es true. `quality.checks` declara seis comprobaciones
del productor: `evidenceSupported`, `answerSupported`, `explanationSupported`,
`unambiguous`, `topicAligned` y `noDuplicates`, todas true para un DRAFT. Son
declaraciones auditables del productor; Spring comprueba estructura y citas por
su cuenta. No se devuelve un porcentaje de confianza inventado. Para QUIZ, ML
también debe evaluar unicidad de respuesta y falsedad contextual de distractores.

### Rangos y presupuestos propuestos

| Campo/recurso | Límite v1 |
| --- | --- |
| QUIZ count / opciones | 1–50 / 2–6 por pregunta; todas distintas sin distinguir mayúsculas |
| CROSSWORD count / gridSize | 2–12 / 5–25; gridSize también obligatorio para QUIZ por compatibilidad H3 |
| IDs / tema / idioma | `[A-Za-z0-9_-]{1,64}` / 1–100 / `es` |
| Enunciado, pista, explicación / opción | 1–2000 / 1–1000 unidades UTF-16, como Java H3 |
| Respuesta de palabra | Original ≤100; normalizada 2–25 letras A–Z/Ñ; sin palabras normalizadas repetidas |
| Fuente | Referencia ≤500; índice 0–1999; cita literal ≤4000 |
| Fragmentos | 1–32, no vacíos, ≤100 000 unidades UTF-16 acumuladas; sin recortes silenciosos |
| Petición / respuesta internas | 512 KiB / 2 MiB de JSON UTF-8 observado, antes del parseo; sin compresión de cuerpo en v1 |
| Profundidad JSON | Máximo 16 niveles, contando raíz como nivel 1 |
| Plazos | Python termina y mata trabajo a 30 s; Spring conecta en 3 s y espera hasta 35 s; BFF espera hasta 40 s |
| Admisión | 1 inferencia activa por instancia Python; sin cola ilimitada; Spring 1 petición activa por alumno y cuota inicial 6/minuto por alumno |

La cuota y los recursos son propuestas a medir. El servicio actual tiene
256 MiB/0,5 CPU; no se asume que un modelo cabe ni se cambia Compose aquí. ML
debe demostrar cancelación del trabajo, sin bloquear salud ni extracción, y
proponer cualquier ajuste al líder antes de implementarlo. Rechazar exceso con
429/503 y Retry-After entero 1–60 s. No entrenar ni descargar modelos en requests.

Normalización H3: NFC, mayúsculas, preservar Ñ, retirar marcas diacríticas,
espacios y guiones. `CAÑON` difiere de `CANON`; una explicación no convierte
una cita incorrecta en evidencia. Los JSON Schema expresan forma y rangos;
el verificador compartido añade igualdad de ecos, conteos, evidencia literal,
unicidad y longitudes UTF-16. La corrección semántica requiere evaluación ML y
revisión humana.

## Fallos

Error interno uniforme: `schemaVersion`, `requestId` (null si la autenticación o
la cabecera impiden correlacionar), `status`, `code`, `message`, `details`. Mensaje
seguro sin fragmentos, respuestas, nombres, credenciales ni trazas del proveedor.
`details` solo admite `availableCount` y `reasonCodes` de un catálogo acotado.

| HTTP | Código | Decisión |
| --- | --- | --- |
| 400 | INVALID_DRAFT_REQUEST, UNSUPPORTED_SCHEMA_VERSION | Corregir JSON, headers o parámetros |
| 401 / 403 | UNAUTHORIZED / FORBIDDEN | Rechazar servicio; Spring muestra indisponibilidad segura |
| 413 | PAYLOAD_TOO_LARGE | Reducir selección explícitamente |
| 422 | INSUFFICIENT_CONTENT | No alcanza la evidencia para tema/count; availableCount opcional indica candidatos respaldados, no una promesa |
| 422 | CONTENT_QUALITY_FAILED | OCR_UNREADABLE, AMBIGUOUS_QUESTION, UNSUPPORTED_EXPLANATION o DUPLICATE_CONTENT |
| 429 | GENERATOR_BUSY | Retry-After; conservar selección y reintento explícito |
| 500 / 503 | GENERATOR_ERROR / GENERATOR_UNAVAILABLE | No crear borrador aceptado ni actividad |
| 504 | GENERATION_TIMEOUT | Terminar el trabajo; no aceptar éxito parcial |

No devolver un DRAFT incompleto ni completar con conocimiento externo. Texto
vacío, tema ausente o demasiado pocas respuestas sustentadas producen 422.
OCR_APPLIED es una advertencia, no un error por sí sola; texto ilegible o ambiguo
que no admite contenido fundamentado produce 422. PROVENANCE_UNVERIFIED se
conserva y no se convierte en verificación C2PA.
El catálogo v1 de advertencias es OCR_APPLIED, PROVENANCE_UNVERIFIED y
ASSOCIATED_FILES_IGNORED. No se admiten mensajes libres del modelo en esa lista;
otros códigos requieren evolución coordinada del contrato.

Python no puede detectar si cambió Mongo: `409 EXTRACTION_CHANGED` pertenece a
Spring, al comparar el snapshot antes/después y al publicar. Respuesta Python
malformada, eco diferente, evidencia falsa, validated:true o cuerpo excesivo
producen 502 GENERATOR_CONTRACT_INVALID público, sin devolver el cuerpo inválido.
Errores públicos mantienen `{timestamp,status,code,message,fields}` de Spring y
correlación por cabecera. Documento no READY: 409 TEXT_NOT_READY.

## Fachada Spring/Next.js prevista

Estas rutas son propuestas, no están en el BFF ni en OpenAPI de producción:

| Método y ruta `/api/v1` | Entrada y salida |
| --- | --- |
| POST `/subjects/{subjectId}/activity-drafts` | documento, versión esperada, índices, tipo/tema/count/gridSize; 201 con Location y borrador privado |
| GET `/activity-drafts/{draftId}` | 200 privado autorizado; no publica ni confirma |
| PUT `/activity-drafts/{draftId}` | draftRevision esperada y draft editado con validated:false; 200 y revisión incrementada |
| POST `/activity-drafts/{draftId}/publish` | draftRevision, reviewConfirmed:true, idempotencyKey; 201 ActivityView H3 y Location, o 200 en repetición |

El POST público no acepta fragmentos libres, ownerId, studentId, quality,
generatorVersion, claves de servicio ni puntuación. Si el alumno no selecciona
fragmentos en la interfaz, Next seleccionará los índices ofrecidos hasta el
límite; una selección mayor necesita reducción explícita y nunca truncado oculto.
La expiración de 24 h, revisión y estado son autoridades del servidor.

Las entradas públicas se describen en `$defs/PublicDraftRequest`,
`$defs/ReviseDraftRequest` y `$defs/PublishDraftRequest` del esquema. La respuesta
privada `$defs/PublicDraftView` incluye draftId, subjectId, documentId,
extractionVersion, type, topic, count, gridSize, draftRevision, expiresAt, status
AWAITING_REVIEW, draft, quality, qualityAppliesToRevision, warnings y generatorVersion.
IDs, revisión, expiración y estado los fija Spring; requestId de ML solo se
conserva en auditoría privada. [Ejemplo completo](contracts/h5/fixtures/public-response.json).

`qualityAppliesToRevision:1` vincula las declaraciones originales de ML al borrador
generado. Después de una edición no se atribuyen al contenido modificado; Spring
revalida estructura/evidencia y exige revisión humana de la nueva revisión. PUT
conserva tipo, tema, cantidad y gridSize; cambiarlos requiere solicitar otro
borrador. GET de un borrador publicado devuelve 409 DRAFT_ALREADY_PUBLISHED con
la referencia autorizada a la actividad; el resultado idempotente de publicación
se recupera por su POST con la misma clave.

```json
{
  "draftRevision": 2,
  "reviewConfirmed": true,
  "idempotencyKey": "00000000-0000-4000-8000-000000000010"
}
```

Sin confirmación o con false: 400 REVIEW_REQUIRED; revisión vieja:
409 DRAFT_REVISION_CONFLICT; expirado: 410 DRAFT_EXPIRED; ya publicado con otra
clave: 409 DRAFT_ALREADY_PUBLISHED. Misma clave y otro cuerpo:
409 IDEMPOTENCY_CONFLICT. Antes de crear ActivityBank, eliminar solo campos del
DTO draft que no pertenecen a H3 (unidad y explicación de palabra), conservarlos
en auditoría y establecer validated:true desde la confirmación autenticada.
Aplicar otra vez validación H3 y Abstract Factory. INVALID_CROSSWORD conserva el
borrador y no marca publicación exitosa; la cuadrícula la decide H3, no Python.
Los ejemplos [Quiz revisado](contracts/h5/fixtures/reviewed-quiz-h3-request.json) y
[Crucigrama revisado](contracts/h5/fixtures/reviewed-crossword-h3-request.json)
ilustran ese mapeo tras una revisión sintética; no se envían desde el generador
ni sustituyen la confirmación del estudiante en la aplicación.

## Datos y coordinación

El texto del documento se trata como entrada no confiable. El generador separará
instrucciones de datos y no dispondrá de herramientas, red o secretos a los que
pueda acceder por instrucciones embebidas. Spring verificará la salida aunque ML
declare checks aprobados. Estos controles siguen la guía de
[prevención de prompt injection de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).
No renderizar HTML del modelo ni introducir Markdown activo en la vista.

El acuerdo v1 debe resolver ejecución local o proveedor autorizado, retención,
versiones de modelos/plantillas, evaluación semántica y recursos. No enviar
documentos a proveedores externos ni usarlos para entrenamiento sin coordinación
explícita. Logs y métricas guardan IDs, códigos, duración y tamaños; no prompt,
fragmentos, soluciones, token ni respuesta íntegra. El servicio no guarda textos
tras la petición en la propuesta v1; los borradores privados persisten en Spring.

Registro de acuerdo para completar en la revisión conjunta:

El usuario confirmó el 19/11/2026 que aún no se ha recibido respuesta del
responsable ML. Ninguna decisión de la tabla tiene conformidad del productor.

| Decisión | Propuesta del consumidor | Conformidad ML |
| --- | --- | --- |
| Ruta, DTO y schemaVersion | Endpoint interno v1 y ActivityBankDraft independiente | Pendiente |
| Extracción y evidencia | operationId READY, fragmentos autorizados, fuente única por ítem | Pendiente |
| Autenticación y datos | Token independiente, sin retención ML ni entrenamiento con documentos | Pendiente |
| Recursos y tiempos | 30 s de trabajo, 35 s Spring, una inferencia activa; medir con el límite actual | Pendiente |
| Calidad | Rechazar insuficiencia/ambigüedad, corpus y métricas revisados por ML | Pendiente |
| Pruebas compartidas | Fixtures v1 de esta carpeta y pruebas de productor/consumidor | Pendiente |

Registrar nombre del responsable, fecha, commit aceptado, desviaciones y resultados
de evaluación antes de habilitar el adaptador. Esta tabla no representa un acuerdo
ya obtenido.
