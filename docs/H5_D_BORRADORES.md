# H5-D: persistencia, revisión y publicación de borradores

Rama `feature/h5-d-persistencia-borradores`, basada en H5-B `ca27a80`.
El código de esta rama requiere V6; no está instalado en la composición habitual.
La integración y el despliegue requieren revisión y autorización posterior.
No se habilita ML, no se cambia la interfaz ni la allowlist BFF.

## Ciclo de vida

`AcademicDraftUseCase.create` es una entrada interna de aplicación. Reutiliza
`GenerateAcademicDraftService.generateCaptured`, sus autorizaciones, admisión y
verificación H5-B. Conserva el resultado solo después de comprobar otra vez la
materia y la huella documental. El bean de producción sigue devolviendo
`503 GENERATION_DISABLED`; no existe POST HTTP de creación ni un endpoint para
inyectar fixtures. Los productores sintéticos viven exclusivamente en tests.

El borrador comienza en revisión 1, `AWAITING_REVIEW`, `validated:false`, con
vigencia de 24 horas desde su aceptación. El reloj es inyectado. `expires_at` en
MySQL decide la expiración en cada operación, incluso después de reiniciar JVM
o MySQL; no depende de mapas, tareas programadas ni Redis. La expiración es un
estado derivado: las filas no se eliminan ni necesitan actualizarse para vencer.

Una edición reemplaza el banco privado, conserva tipo, tema, cantidad,
cuadrícula y procedencia, y aumenta la revisión. El UPDATE condicional por revisión
y estado detecta ediciones simultáneas u obsoletas. La edición vuelve a validar
estructura, referencias, citas y respuestas contra el documento vigente.
No confirma revisión humana ni cambia `validated:false`.

Los seis checks ML originales se conservan con `qualityAppliesToRevision:1`, como
exige el contrato v1. Si `draftRevision` es mayor que 1, esos checks no describen
el contenido actual. `validation_json` almacena por separado la revisión y las
comprobaciones deterministas de Spring. No se atribuye validación semántica a
Spring ni se inventa confianza ML. Los esquemas, fixtures y contratos H5 v1
permanecen sin cambios.

La publicación requiere `reviewConfirmed:true` y una revisión vigente. Solo aquí
se construye `ActivityBank(validated:true)`: se conservan los campos H3, se omiten
del banco H3 las unidades y la explicación de palabra que ese tipo no admite,
y se mantienen en el borrador privado. Se llama a `ActivityUseCase.create`, que
reutiliza el generador H3 y sus productos Abstract Factory. No hay otro generador.
Una cuadrícula imposible devuelve `INVALID_CROSSWORD` y permite revisar el borrador.

## API implementada

| Operación | Comportamiento |
| --- | --- |
| GET `/api/v1/activity-drafts/{draftId}` | Borrador privado propio pendiente de revisión |
| PUT `/api/v1/activity-drafts/{draftId}` | `{draftRevision,draft}` con `draft.validated:false`; incrementa revisión |
| POST `/api/v1/activity-drafts/{draftId}/publish` | `{draftRevision,reviewConfirmed:true,idempotencyKey}`; devuelve ActivityView H3 |

La primera publicación responde 201 y `Location: /api/v1/activities/{activityId}`;
una repetición confirmada devuelve 200 con la misma actividad y Location.
Las fechas de creación H3 se normalizan a microsegundos antes de persistir,
para que la primera respuesta coincida con la recuperada de `TIMESTAMP(6)`.

GET/PUT de un publicado: 409 `DRAFT_ALREADY_PUBLISHED` con `fields.activityId`
solo después de autorizar al propietario. GET/PUT/publicación nueva de un vencido:
410 `DRAFT_EXPIRED`. Revisión obsoleta: 409 `DRAFT_REVISION_CONFLICT`.
Confirmación ausente, null o false: 400 `REVIEW_REQUIRED`.

El parser público reutiliza las definiciones congeladas `ReviseDraftRequest` y
`PublishDraftRequest`: UTF-8 estricto, claves duplicadas y campos desconocidos
rechazados, profundidad 16, sin coerción de tipos ni JSON adicional. Lee como
máximo 2 MiB + 1 byte para detectar exceso, sin confiar en Content-Length.
Los límites por campo y familia son los mismos de H5 v1.

`docs/openapi.json` añade únicamente estas tres operaciones. La ruta de creación
ausente aparece en `x-disabled-operations`, fuera de `paths`. La especificación
interna propuesta de Python sigue separada y pendiente de acuerdo ML.

## Transacción e idempotencia

`TransactionPort` usa el gestor MySQL existente para JDBC y JPA. La publicación
bloquea en orden `user_access`, materia y borrador. El bloqueo de identidad evita
desactivar la cuenta durante la confirmación; el de materia serializa su archivo
con la publicación. El bloqueo del borrador usa la lectura actual de InnoDB
`SELECT ... FOR UPDATE`, descrita en la [documentación MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html).

La clave es un UUID canónico y su ámbito es el borrador del propietario.
La huella SHA-256 representa draftId, revisión y confirmación true. La revisión
identifica un contenido que no puede cambiar sin incrementarse. Clave y huella
confirmadas se guardan en la misma fila que referencia la actividad real mediante FK.
Con el bloqueo de fila, varias instancias Spring también comparten la decisión;
no hay caché ni mutex de proceso como autoridad de publicación.

Misma clave y contenido: recuperar actividad existente. Misma clave y otra
revisión: 409 `IDEMPOTENCY_CONFLICT`. Otra clave sobre un publicado:
409 `DRAFT_ALREADY_PUBLISHED`. Una recuperación autorizada sigue siendo posible
después del vencimiento o archivo de la materia; verifica identidad vigente y
propiedad actual, pero no crea nada ni requiere que Mongo conserve el documento.
Una petición sin confirmación válida siempre se rechaza con `REVIEW_REQUIRED`.

El insert H3 y la marca de publicación forman una transacción MySQL. Una excepción
después del insert, una cuadrícula inválida o un cambio documental detectado
revierten la transacción; la clave no queda consumida. No se crean intentos,
eventos ni envíos Express al publicar. El intento posterior conserva H3.

## Frontera documental MySQL/MongoDB

Se conserva versión `operation:{UUID}`, índices seleccionados y huella SHA-256
de metadatos y extracción completa observada. Se almacena la huella, no esa
extracción completa. El snapshot comprueba metadatos antes y después de leer
fragmentos. Cambios de texto incluso con el mismo operationId cambian la huella.

Al publicar se verifica propietario del documento, materia, estado READY,
operationId y huella; se verifican citas literales, referencias/unidades, respuestas
y estructura. H3 vuelve a validar sus reglas. Después del insert H3 y antes de
marcar publicación se lee de nuevo el snapshot. Un cambio observado provoca rollback
MySQL. Documento no READY: `TEXT_NOT_READY`; versión/huella diferente:
`EXTRACTION_CHANGED`; documento reasignado: `FORBIDDEN`.

No hay atomicidad distribuida. Mongo puede cambiar después de la última lectura
y antes del commit MySQL. La actividad confirmada conserva el contenido revisado
y la evidencia de la versión aceptada; no se actualiza silenciosamente. Cerrar
esa ventana exige snapshots documentales inmutables o un protocolo de revisión
entre motores, fuera de esta fase. Estas pruebas sustituyen el puerto Mongo por
fixtures; no acreditan nuevas carreras de un clúster Mongo real ni OCR.

## Persistencia y privacidad

V6 crea únicamente `academic_drafts`. Incluye propietario, materia/documento,
familia/parámetros, versión/huella/selección de extracción, respuesta privada,
versión del generador, checks Spring/ML, revisión, confirmación, fechas y resultado
idempotente. No altera V1–V5. Las advertencias están en la respuesta privada.

No se guardan PDF, credenciales ni el texto completo del documento. Las citas
necesarias sí forman parte de la evidencia privada. El contenido sigue el modelo
H3 de snapshots restringidos en MySQL: no se añade una clave criptográfica ni
se afirma cifrado aplicativo en reposo. Los accesos al volumen, DB y respaldos
siguen bajo los controles de infraestructura existentes.

La identidad se obtiene del JWT/sesión vigente. Ningún rol puede sustituir al
propietario enviando ownerId, studentId o permisos simulados. GET y PUT contienen
soluciones porque son operaciones privadas de revisión del autor. La publicación
devuelve la proyección H3, sin respuestas correctas, explicaciones ni citas.
Todas las respuestas de estas rutas, incluidos errores, llevan `Cache-Control:
no-store`. DTO y agregados tienen toString redactado. No registrar cuerpos,
parámetros enlazados SQL, cabeceras Bearer ni snapshots privados en producción.

## Pruebas y despliegue posterior

Ver [evidencias H5-D](H5_D_VALIDACION_20261119.md). Reproducción con JDK 21:

```powershell
./scripts/Test-H5D.ps1 -Offline -MavenRepository 'D:/ruta/cache/m2'
```

El script no lee `.env`. Usa MySQL 8.4.13 fijado por digest, puerto loopback 13326,
contenedor y volumen exclusivos etiquetados, bases `siare_h5d_test` y
`siare_h5d_migration_test`, y credenciales sintéticas de prueba. Conserva logs,
dump nativo V5 y metadatos de ejecución en `.cache/h5d/{runId}`. Detiene solo su
contenedor; lo conserva con su volumen. No borra bases/volúmenes de la instalación.
El restore reemplaza únicamente su esquema desechable de migraciones.

Antes de un despliegue autorizado: respaldo oficial consistente y verificado,
revisión de V6 y autorización de integración; conservar la imagen funcional
actual. Reconstruir/recrear solo core-api con los controles Compose oficiales
y `--no-deps` cuando proceda, esperar healthy y comprobar el sistema por 3100.
Revertir la imagen no elimina V6 ni sustituye restaurar un respaldo. Un rollback
de datos requiere una ventana acordada y evaluar escrituras posteriores.

## Pendientes del integrante ML

1. Aceptar explícitamente los contratos H5 v1 y fixtures compartidos, registrando
   responsable, fecha y commit; resolver desviaciones antes de habilitar rutas.
2. Entregar el generador Python aprobado: servicio autenticado, versión de modelo
   y plantilla, procedencia, calidad semántica de respuestas/distractores y evaluación.
3. Demostrar límites de recursos, cancelación, plazos, admisión, ausencia de retención
   y separación del servicio de extracción; provisionar token independiente sin Git.
4. Conectar el adaptador HTTP existente por un cambio revisado; entonces exponer
   creación desde documentos a través del caso de uso persistente y probar end-to-end.
5. Acordar el tratamiento de snapshots documentales concurrentes. La interfaz y
   ampliación de BFF serán fases posteriores independientes.
