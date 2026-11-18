# Contratos de integración del equipo

Corte de código: `035d74e1e953573c24b9f1371cf604ce62b1a98b` (18/11/2026). Esta guía describe interfaces existentes y propuestas para desarrollo independiente. Las propuestas requieren acuerdo entre productor, consumidor y líder antes de implementarse. Este PR no añade rutas, DTO, credenciales, migraciones ni configuración ejecutable.

## Inventario y autoridad

| Comunicación | Implementado en la base | Pendiente |
| --- | --- | --- |
| Spring / Python | Extracción documental interna y salud Flask | Análisis académico, dificultades y recomendaciones ML |
| Spring / Express | Salud Express con consulta Cassandra; no hay integración de negocio desde Spring | Registro de intentos, progreso, indicadores, ingesta OLAP y caché |
| React Native / Spring | API directa de login local, MFA, sesiones, permisos, materias y documentos | Cliente Android, APK, actividades, progreso/recomendaciones públicos y OIDC nativo |
| Web / Spring | Next.js y BFF con cookies; OIDC web Google/GitLab | Nuevas pantallas de actividades e indicadores |

Spring autoriza al usuario y verifica propiedad de materias/documentos/actividades. Los clientes llaman a Spring; no reciben credenciales internas ni acceden a bases, Python o Express. Python recomienda refuerzo; Spring genera/evalúa actividades con Abstract Factory. Express persiste resultados evaluados por Spring. Los `studentId` internos provienen de la identidad verificada, no de un UUID libre enviado por un cliente.

Fuentes: [OpenAPI vigente de Spring](openapi.json), [contrato móvil detallado](CONTRATO_API_MOBILE.md), [controlador Flask](../services/content-ai/app/controllers/extraction_controller.py), [vista Flask](../services/content-ai/app/views/extraction_view.py), [adaptador Spring](../services/core-api/siare-core/src/main/java/com/siare/core/infrastructure/adapter/out/document/HttpDocumentProcessor.java) y [rutas Express](../services/progress-api/src/routes/health.routes.ts). OpenAPI contiene solo las operaciones Spring entregadas; las propuestas de este documento no se añaden como operaciones implementadas.

## Spring / Python: extracción existente

Destino interno `http://content-ai:5000`. `GET /health`, sin Bearer, devuelve HTTP 200 o 503 y `{"service":"content-ai","status":"UP"}` o `DOWN`; comprueba MongoDB/Redis, no calidad ML.

`POST /internal/v1/extractions` está implementado. Headers obligatorios:

| Cabecera | Valor |
| --- | --- |
| `Authorization` | `Bearer <CONTENT_SERVICE_TOKEN>`; secreto interno configurado, al menos 32 caracteres; no es JWT de usuario |
| `X-Operation-Id` | UUID canónico, correlacionado por Spring con la operación |
| `X-Document-Type` | `PDF`, `DOCX`, `PPTX`, `JPEG` o `PNG` |
| `Content-Type` | MIME correspondiente: PDF, Office Open XML, `image/jpeg` o `image/png` |

Cuerpo: bytes del archivo, sin JSON, multipart, URL, ID Mongo ni ID de usuario. Límite predeterminado del archivo: 15 MiB. Spring conserva propiedad y original. Respuesta HTTP 200 de ejemplo sintético:

```json
{
  "operationId":"00000000-0000-4000-8000-000000000001",
  "result":{
    "fileType":"PDF", "text":"Texto de ejemplo.",
    "fragments":[{"index":0,"unitType":"page","unitNumber":1,"text":"Texto de ejemplo."}],
    "unitCount":1, "warnings":[], "extractionStatus":"READY"
  }
}
```

Fragmentos con índice desde cero, unidad desde uno y tipo `page`, `slide`, `section` o `image`. `text` une los fragmentos con dos saltos de línea. Spring limita texto a 1 000 000 caracteres y 2000 fragmentos, y valida consistencia del resultado. Flask limita a un parser simultáneo por instancia del modelo; responde saturación sin cola ilimitada. El parser termina tras 25 segundos; el adaptador Spring usa conexión de 3 segundos y petición de 35 segundos. No reutilizar estos plazos como SLA del futuro ML.

Error interno: `{"operationId":"00000000-0000-4000-8000-000000000001","errorCode":"CORRUPT_DOCUMENT"}`. `operationId` es null si falla autenticación o validación de operación.

| HTTP Flask | `errorCode` existente |
| --- | --- |
| 400 | `INVALID_OPERATION`, `EMPTY_FILE` |
| 401 | `UNAUTHORIZED` |
| 413 / 415 | `FILE_TOO_LARGE` / `UNSUPPORTED_FORMAT` |
| 422 | Fallos de extracción: por ejemplo `NO_EXTRACTABLE_TEXT`, `CORRUPT_DOCUMENT`, `PASSWORD_PROTECTED`, `UNSAFE_DOCUMENT`, `EXTRACTION_TIMEOUT`, `TEXT_LIMIT`, `OCR_UNAVAILABLE` |
| 503 | `PROCESSOR_BUSY` |
| 500 | `PROCESSING_ERROR` |

El cliente público recibe el error Spring definido en OpenAPI, no necesariamente el mismo HTTP interno: el adaptador convierte fallos de procesamiento y sanitiza errores de transporte/contrato. `X-Operation-Id` correlaciona; no promete deduplicación persistente en Flask. La idempotencia documental se controla en Spring. Preservar esta interfaz al añadir ML.

## Convenciones propuestas para nuevas API internas

Todo este apartado y los dos siguientes tienen estado **PROPUESTO, NO IMPLEMENTADO**.

- JSON UTF-8 con `Content-Type: application/json`; UUID canónico para IDs y fechas UTC ISO 8601. `schemaVersion` será entero `1`; rechazar versiones no soportadas con 400. Ejemplos con datos sintéticos.
- `Authorization: Bearer <secreto de servicio>` con credenciales independientes propuestas `LEARNING_SERVICE_TOKEN` y `PROGRESS_SERVICE_TOKEN`; solo Spring y el servicio destinatario. Aprovisionamiento, rotación y configuración aún pendientes. No reutilizar JWT de usuario, secretos OIDC ni el token de extracción para progreso/ML. La red Docker por sí sola no autentica al llamante.
- `X-Request-Id: <UUID>` requerido, eco en respuesta y trazas sanitizadas. Límite inicial propuesto de JSON: 1 MiB; validar tipos/rangos, sin convertir cadenas a números. No incluir nombres, correos, documentos, credenciales o respuestas libres.
- Plazos propuestos: conexión 3 segundos, ML 10 segundos, escritura/lectura Express 5 segundos. Ajustar con mediciones antes de aceptar; no ejecutar entrenamiento dentro del request. Máximo dos reintentos con espera creciente y jitter solo para lecturas o POST con clave durable; nunca para 400/401/403/409/422. No reintentar ciegamente un POST ambiguo.
- Respuestas privadas `Cache-Control: no-store`; errores con `requestId`. `Retry-After` en 429/503. No devolver stack, SQL/CQL, datos de conexión ni secretos.

Error JSON propuesto:

```json
{"requestId":"00000000-0000-4000-8000-000000000001","status":400,"code":"VALIDATION","message":"Entrada inválida.","fields":{"score":"Debe estar entre 0 y 1."}}
```

| HTTP propuesto | Código / significado |
| --- | --- |
| 400 | `VALIDATION`, `UNSUPPORTED_SCHEMA_VERSION`: JSON, cabeceras, cursor o rangos inválidos |
| 401 / 403 | `UNAUTHORIZED` / `FORBIDDEN`: credencial de servicio ausente/inválida / operación no permitida |
| 404 | `NOT_FOUND`: recurso inexistente |
| 409 | `IDEMPOTENCY_CONFLICT`, `ATTEMPT_CONFLICT`: misma identidad con contenido diferente |
| 413 / 422 | `PAYLOAD_TOO_LARGE` / `INSUFFICIENT_DATA` para análisis sin observaciones suficientes |
| 429 | `RATE_LIMITED`: cuota agotada |
| 500 / 503 | `INTERNAL_ERROR` / `MODEL_UNAVAILABLE`, `SERVICE_BUSY`, `DEPENDENCY_UNAVAILABLE` |

La credencial autentica a Spring como servicio; Spring sigue siendo responsable de autorización por usuario y ámbito. Antes de exponer estos servicios fuera de la red local se debe acordar transporte autenticado/TLS. No se publica ningún puerto nuevo en esta actividad.

## Spring / Python: aprendizaje adaptativo propuesto

Responsables: 1 consumidor/adaptador; 3 productor/modelo. Endpoint propuesto: `POST /internal/v1/learning/analyses` con respuesta síncrona 200. El análisis no persiste ni entrena en la petición; no se propone GET de análisis almacenado. Para reproducir un resultado, Spring fija `modelVersion` y conserva la versión y el conjunto de observaciones; si no está disponible, 503 `MODEL_UNAVAILABLE`.

Solicitud de ejemplo:

```json
{
  "schemaVersion":1,
  "studentId":"00000000-0000-4000-8000-000000000002",
  "subjectId":"00000000-0000-4000-8000-000000000003",
  "modelVersion":"adaptive-v1",
  "observations":[{
    "attemptId":"00000000-0000-4000-8000-000000000004",
    "topicId":"fracciones", "score":0.4,
    "durationMs":45000, "occurredAt":"2026-11-18T18:00:00Z"
  }],
  "maxRecommendations":3
}
```

Todos los campos son obligatorios. `observations`: de 1 a 1000 elementos, un resultado agregado por tema e intento, sin pares `attemptId/topicId` repetidos. `score`: número finito entre 0 y 1; `durationMs`: entero entre 0 y 86400000. `topicId`: identificador estable acordado con 1, de 1 a 100 caracteres; `modelVersion`: de 1 a 64 caracteres. `maxRecommendations`: entero 1–10. El mínimo estadístico, las etiquetas y umbrales del modelo deben documentarse antes de implementarlo; no se deducen de este ejemplo.

Respuesta propuesta:

```json
{
  "schemaVersion":1,
  "requestId":"00000000-0000-4000-8000-000000000001",
  "studentId":"00000000-0000-4000-8000-000000000002",
  "subjectId":"00000000-0000-4000-8000-000000000003",
  "modelVersion":"adaptive-v1", "analyzedAt":"2026-11-18T18:01:00Z",
  "difficulties":[{"topicId":"fracciones","difficultyScore":0.8,"observationCount":1}],
  "recommendations":[{"topicId":"fracciones","priority":1,"action":"REVIEW_TOPIC","reasonCode":"LOW_MASTERY"}]
}
```

`difficultyScore` entre 0 y 1, mayor valor indica mayor dificultad; no llamarlo probabilidad calibrada sin evaluación. `observationCount` es entero positivo. Cada tema de salida pertenece a la entrada; `priority` empieza en 1, orden ascendente sin duplicados. Propuesta inicial de `action`: `REVIEW_TOPIC` o `PRACTICE_TOPIC`; `reasonCode`: `LOW_MASTERY`. Listas vacías si hay datos suficientes sin dificultad detectada; 422 `INSUFFICIENT_DATA` si no se puede inferir. El ejemplo ilustra estructura, no resultados de un modelo ni el mínimo de datos aceptable.

Pruebas de aceptación futuras: entrada/salida, token inválido, versión no disponible, datos insuficientes, límites, saturación, timeout, reproducibilidad y extracción concurrente conservada. Python no consulta Cassandra/ClickHouse directamente en esta propuesta; Spring obtiene los resultados y prepara observaciones con permisos verificados. Los intentos detallados por tema requieren un contrato posterior: no se inventan a partir del promedio de progreso.

## Spring / Express: progreso y analítica propuestos

Responsables: 1 productor de intentos y consumidor de consultas; 4 persistencia/API. Destino interno existente del servicio `http://progress-api:3001`. `GET /health` ya existe, sin autenticación, HTTP 200/503 `{"service":"progress-api","status":"UP"}` o `DOWN`. Esa ruta solo acredita salud Cassandra; no comprueba aún ML, ingesta ni caché.

### Registro de intento propuesto

`POST /internal/v1/attempts`, headers comunes más `Idempotency-Key: <UUID>`, igual a `eventId`. Spring genera y conserva la misma identidad del evento durante todos los reintentos; evalúa el intento antes de enviarlo.

```json
{
  "schemaVersion":1,
  "eventId":"00000000-0000-4000-8000-000000000005",
  "attemptId":"00000000-0000-4000-8000-000000000004",
  "studentId":"00000000-0000-4000-8000-000000000002",
  "subjectId":"00000000-0000-4000-8000-000000000003",
  "activityId":"00000000-0000-4000-8000-000000000006",
  "activityType":"QUIZ", "eventType":"ATTEMPT_EVALUATED",
  "score":0.4, "durationMs":45000,
  "occurredAt":"2026-11-18T18:00:00Z", "source":"core-api"
}
```

Campos obligatorios; `activityType`: `QUIZ` o `CROSSWORD`. `eventType` y `source` fijos como en el ejemplo; `score` y `durationMs` usan los rangos de ML. Un intento evaluado es inmutable; correcciones/recalificaciones necesitarán contrato adicional. La identidad del alumno y la evaluación proceden de Spring. No se registra canal web/móvil como autoridad ni se envían respuestas/textos.

HTTP 201 solo después de persistencia durable en Cassandra, con:

```json
{
  "schemaVersion":1,
  "requestId":"00000000-0000-4000-8000-000000000001",
  "eventId":"00000000-0000-4000-8000-000000000005",
  "attemptId":"00000000-0000-4000-8000-000000000004",
  "status":"RECORDED", "recordedAt":"2026-11-18T18:00:01Z",
  "analyticsStatus":"PENDING"
}
```

Misma clave y contenido canónico: HTTP 200, sin nuevo evento, con los mismos IDs y `recordedAt`; `requestId` corresponde a la petición actual. Misma clave con contenido diferente: 409 `IDEMPOTENCY_CONFLICT`. Otro `eventId` para el mismo `attemptId`: 409 `ATTEMPT_CONFLICT`. La garantía debe sobrevivir reinicios y carreras; el diseño de tablas/LWT y recuperación queda pendiente de implementar y probar. Una caída después del commit pero antes de responder permite repetir exactamente el evento. Cassandra caída antes de confirmar escritura: 503, sin afirmar éxito.

`analyticsStatus=PENDING` distingue el registro durable de la futura ingesta asíncrona. El registro no promete atomicidad con ClickHouse/Redis. La tabla MergeTree actual no deduplica por sí sola: el integrante 4 debe acordar y demostrar deduplicación y recuperación antes de contar eventos en indicadores.

Mapeo previsto a ClickHouse: `eventId` a `event_id`, `occurredAt` a `occurred_at`, `studentId` a `student_id`, `subjectId` a `subject_id`, `activityId` a `activity_id`, `eventType` a `event_type`, `durationMs` a `duration_ms`, `schemaVersion` a `schema_version`; `score` y `source` conservan nombre. El esquema actual no contiene `attemptId` ni `activityType`: su conservación en Cassandra y cualquier ampliación OLAP deben diseñarse y revisarse antes de implementar la ingesta. No insertar el JSON directamente en la tabla existente ni modificar el SQL compartido sin coordinación.

### Consultas propuestas

| Método y ruta | Parámetros y resultado |
| --- | --- |
| `GET /internal/v1/students/{studentId}/progress` | `subjectId` UUID obligatorio, `limit` entero 1–100 (20 por defecto), `cursor` opaco opcional; 200 con progreso paginado por actividad |
| `GET /internal/v1/students/{studentId}/indicators` | `subjectId`, `from`, `to` obligatorios; intervalo UTC `[from,to)`, máximo 31 días; 200 agregado sobre intentos deduplicados |

Progreso:

```json
{
  "schemaVersion":1, "requestId":"00000000-0000-4000-8000-000000000001",
  "studentId":"00000000-0000-4000-8000-000000000002",
  "subjectId":"00000000-0000-4000-8000-000000000003",
  "items":[{
    "activityId":"00000000-0000-4000-8000-000000000006",
    "attemptCount":1, "bestScore":0.4, "lastScore":0.4,
    "lastAttemptAt":"2026-11-18T18:00:00Z"
  }],
  "nextCursor":null, "asOf":"2026-11-18T18:00:01Z"
}
```

Orden estable por `activityId`; cursor vinculado a estudiante/materia, sin offset global. `attemptCount` cuenta intentos únicos; último por `occurredAt` y desempate `attemptId`; `bestScore` es el máximo. Sin actividad registrada: `items:[]`, `nextCursor:null`. `asOf` indica lectura del progreso, no sincronización con ClickHouse. La consistencia exacta de paginación durante nuevas escrituras debe resolverse en las pruebas del diseño Cassandra.

Indicadores:

```json
{
  "schemaVersion":1, "requestId":"00000000-0000-4000-8000-000000000001",
  "studentId":"00000000-0000-4000-8000-000000000002",
  "subjectId":"00000000-0000-4000-8000-000000000003",
  "from":"2026-11-01T00:00:00Z", "to":"2026-11-19T00:00:00Z",
  "attemptCount":1, "averageScore":0.4, "totalDurationMs":45000,
  "asOf":"2026-11-18T18:01:00Z", "ingestionLagMs":1000
}
```

Media no ponderada de score por intento único; duración sumada una vez. Sin eventos: conteo/duración cero y media null. `asOf` será el watermark de ingesta confirmada, `ingestionLagMs` el retraso medido; null cuando aún no exista watermark, sin inventar frescura. Son consultas con consistencia eventual. Fallos de fuente durable devuelven 503; no convertirlos en progreso cero.

Caché propuesta: prefijo propio `progress:v1:`, TTL de 60 s; claves incluyen estudiante, materia, filtros y versión durable. Al aceptar evento, incrementar versión/invalidar progreso; al confirmar ingesta, invalidar indicadores. Una lectura antigua no debe repoblar la versión nueva. Redis indisponible: consulta directa a la fuente con carga acotada. No borrar claves ajenas ni usar Redis como único registro de idempotencia. Instrumentar fallos y retraso; no se entregan estas garantías en el código actual.

Pruebas futuras: duplicados secuenciales/concurrentes y tras reinicio, conflicto de contenido, caída después de persistir, recuperación de ingesta, deduplicación OLAP, TTL/invalidez con lectura concurrente, Redis caído, aislamiento por estudiante/materia, paginación y carga.

## React Native / Spring: contrato existente y ampliaciones

La fuente de métodos, JSON, errores y límites ya existe en [CONTRATO_API_MOBILE.md](CONTRATO_API_MOBILE.md) y [OpenAPI](openapi.json); se conserva sin duplicarla. Resumen de operaciones implementadas, todas con prefijo `/api/v1`:

| Área | Métodos y rutas existentes |
| --- | --- |
| Local | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` |
| MFA | `POST /auth/mfa/enroll`, `/confirm`, `/verify`, `/recover`; gestión autenticada en `/users/me/mfa` y subrutas según contrato móvil |
| Sesiones/permisos | `GET /users/me`, `/users/me/identity`, `/users/me/sessions`; `DELETE /users/me/sessions/{id}`; `POST /users/me/sessions/revoke-others` y `/revoke-all` |
| Materias | `POST/GET /subjects`, `GET/PATCH /subjects/{id}`, `PATCH /subjects/{id}/archive` |
| Documentos | `POST/GET /subjects/{subjectId}/documents`; `GET /documents/{documentId}`, `/download`, `/text`; `POST /documents/{documentId}/process` |

Autenticación: Bearer JWT SIARE para rutas protegidas; login/registro públicos, refresh con su credencial opaca, desafío MFA con `challengeToken`. Respetar MFA antes de recibir sesión, renovación única en curso, rotación, revocación y almacenamiento protegido. El móvil no usa cookies BFF ni token interno. Error Spring existente: `{timestamp,status,code,message,fields}`; no confundirlo con el error interno propuesto con `requestId`.

No hay endpoints de actividades disponibles en la base. Para permitir un primer cliente se propone **solo para discusión** `GET /api/v1/subjects/{subjectId}/activities` con Bearer, autorización de propietario, sin cuerpo, HTTP 200:

```json
{"items":[{"activityId":"00000000-0000-4000-8000-000000000006","subjectId":"00000000-0000-4000-8000-000000000003","type":"QUIZ","title":"Fracciones","available":true}],"nextCursor":null}
```

Propuesta: `limit` 1–100 (20 por defecto), cursor opaco, orden por `activityId`, lista vacía si no hay actividades; `type` será `QUIZ` o `CROSSWORD`. Errores usarán formato Spring: 400 entrada, 401 sesión, 403 permiso, 404 materia, 503 dependencia. El líder debe cerrar contrato de ejecución/respuesta/evaluación, paginación y permisos antes del desarrollo móvil de actividades. Esta ruta no existe todavía; no prometer resultados de quiz ni crucigramas.

Tampoco existen fachadas Spring para progreso, indicadores y recomendaciones. Sus rutas/DTO públicos quedan por acordar con 2 tras validar propuestas internas con 3/4; no apuntar el APK a las rutas `/internal`. OIDC web está implementado; el usuario reportó prueba manual exitosa de GitLab el 18/11/2026, sin desglose de casos ni artefactos nuevos. Esa confirmación no implementa OIDC nativo ni sustituye pruebas automatizadas. Registro y límites en [GitLab real](H2B2_GITLAB_REAL.md).

## Acuerdo y evolución

Antes de implementar: 1 y 3 cierran temas/dataset/modelo; 1 y 4 cierran intento, unicidad, particiones, watermark y caché; 1 y 2 cierran actividades públicas, guía visual, HTTPS y OIDC nativo. Ninguna propuesta se considera aprobada técnicamente solo por aparecer aquí. Registrar acuerdo y cambio de estado en el PR del módulo, con fixtures y pruebas de consumidor/productor.

Cada cambio incompatible necesita coordinación previa, nueva versión o transición explícita, actualización documental y regresiones. Los contratos existentes se preservan hasta revisar su evolución. No cambiar código ajeno para adaptar silenciosamente una propuesta.
