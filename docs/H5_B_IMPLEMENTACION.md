# H5-B: consumidor Spring preparado, generación deshabilitada

19/11/2026, America/Bogota. Esta entrega instala el consumidor hexagonal y prueba
su transporte con un servidor HTTP simulado. No hay un generador ML conectado,
nuevas rutas públicas, publicación de borradores ni generación automática operativa.

## Git y condición de integración

El usuario autorizó explícitamente fusionar #6 y después #7 con commits de merge,
condicionado a pruebas pasadas, HEAD esperado y ausencia de conflictos pendientes.
Se comprobaron esas condiciones antes de cada fusión. Ambos PR están fusionados;
main local y remoto están consolidados, sin rebase, squash ni force-push.

| Referencia | Estado comprobado |
| --- | --- |
| main / origin/main consolidado | `c8f934492f0cc7809282657270df34b4474915ca`; conserva como ancestro el main anterior `6c3a742` |
| PR #6 | Fusionado a las 17:23:50, America/Bogota; HEAD esperado `acba2808ad0908ff05d6852cedb6eba5cb281171`; merge `fe2f39d6f2235533f70bf8219e8f26ebc3a219b6` |
| PR #7 | Actualizado desde `1e8658e` a `a5810a23a78556fd321ba695fe82ac79302c396f`; fusionado a las 17:25:53 mediante `c8f934492f0cc7809282657270df34b4474915ca` |
| Preparación local #6 | `ac265f095b942099629682891c2868511276f55e`, merge de main y HEAD #6 |
| Preparación conjunta | `3792e5fee2d7dfc7cbd491c5b3c281051611d68c`, rama `integration/consolidation-h5-prepared` |
| H5-A preservado | `303a0d1cd7bf26ce0323bd0d6f42cb83497ece49`, 21 archivos sin cambios de contenido |
| Trabajo consumidor | Rama `feat/h5-b-generation-port`, worktree `.worktrees/h5-b` |
| Incorporación de main a H5 | Merge `24b2c2e28005733168951e04a473dd7c8febb9b1`, sin diferencias de árbol respecto a H5 probado `252f694` |

Se revisaron commits, diferencias, revisiones, estados, check-runs y workflows de
ambos HEAD en GitHub, incluido el HEAD actualizado de #7. Las listas de
revisiones/checks/workflows estaban vacías; el estado agregado sin estados era
pending. GitHub confirmó CLEAN/MERGEABLE antes de ambos merges. No se atribuye
aprobación de CI ni se usaron opciones para omitir protecciones.

La preparación conjunta conserva todos los padres y commits. Su árbol
`ad029248b4b9e7eed0461aed147edc2d123e4ca1` es idéntico al árbol de la integración
ya desplegada `697621ee8a6a450c551bbf6f13ffda6fc2beab18`. Se reutilizó esa
resolución revisada; no quedaron entradas sin resolver. Se preservan los paneles
H4, selección y descarga exclusivas para READY, cuarentena, avisos C2PA/OCR,
texto escapado y política BFF. No se hizo un cambio de diseño.

El árbol de main consolidado es exactamente el mismo árbol de la preparación y
del frontend ya desplegado. #7 incorpora main con #6 y conserva la resolución
documental revisada; las 31 pruebas de frontend pasaron de nuevo antes del merge.
No hubo nuevos conflictos ni cambios ejecutables durante la consolidación.

El [PR H5 #8](https://github.com/SttivGG/siare-academico/pull/8) continúa abierto
como draft, ahora dirigido a main consolidado. Su diff contiene exclusivamente
H5-A/H5-B. La incorporación de main a H5 conserva todos los commits y no cambió
el código probado; los cambios posteriores solo actualizan estos informes. H5 no
tiene auto-merge y su generación de producción permanece deshabilitada.

## Preservación de H5-A y del checkout habitual

Antes de crear ramas se copiaron los tres documentos H5-A, la carpeta completa de
contratos/fixtures y sus scripts offline: 21 archivos. Respaldo y manifiesto
SHA-256: `.local/h5-consolidation-20261119/h5-a-manifest.json`. La copia en la rama
H5 es idéntica por bytes a esos originales. Se conservaron también las huellas
de los 29 archivos locales existentes; no se usó stash, reset ni checkout sobre
el árbol con cambios ajenos. Los originales continúan en el checkout habitual.

Los informes H5-A son registros históricos: sus afirmaciones sobre ausencia de
código corresponden a esa entrega. Se mantienen intactos; este documento explica
el estado posterior. El contrato sigue propuesto y pendiente del responsable ML.

## Componentes implementados

| Componente | Responsabilidad |
| --- | --- |
| `AcademicDraftGenerator` | Puerto de salida sin proveedor, persistencia ni autoridad para publicar/evaluar |
| `GenerateAcademicDraftUseCase` / `GenerateAcademicDraftService` | Comprueban identidad habilitada, propietario, materia activa, documento READY y selección; reautorizan antes de devolver el resultado |
| `AcademicDraft.Selection` | Solo IDs, versión, índices y parámetros; no acepta texto libre ni identidad del cliente |
| `AcademicDraft.Bank` y DTO asociados | Borrador independiente de `ActivityBank`; conserva `validated:false` y revisión humana obligatoria |
| `DraftEvidence` | Ecos, familia/cantidad, unicidad, tema, clave existente, referencia/unidad exactas, fragmento seleccionado, cita literal y presencia normalizada de la respuesta; conserva Ñ |
| Snapshot documental | Usa `operation:<operationId>` y SHA-256 de metadatos y contenido completo; detecta cambios de operación, estado y contenido, incluso bajo la misma operación |
| `HttpAcademicDraftGenerator` | POST interno con token separado, requestId, 3 s de conexión, plazo total máximo 35 s incluyendo cuerpo, sin redirects ni reintentos automáticos |
| `DraftJsonContract` / `DraftBodySubscriber` | JSON UTF-8, claves duplicadas, Unicode, profundidad 16, esquemas cerrados, límites UTF-16, 512 KiB de petición y 2 MiB de respuesta observados, también en chunked |
| `DraftAdmission` | Una solicitud activa por instancia, sin cola; cuota 6/minuto por usuario, mapa acotado y liberación del permiso al fallar |
| `DraftGenerationException` | Código/estado seguros y Retry-After acotado; no propaga mensajes ni contenido del proveedor |
| `AcademicDraftConfiguration` | Conecta exclusivamente un puerto que falla con 503 GENERATION_DISABLED; ningún flag de entorno activa el adaptador HTTP |

El esquema empaquetado es una copia exacta de H5-A. Una prueba compara sus bytes
y SHA-256 normalizado a LF para los checkouts Linux, y compara las fixtures cuando
está disponible la raíz del repositorio.
Las copias permiten ejecutar el Dockerfile existente, cuyo contexto solo incluye
el módulo Java. El evaluador offline implementa las palabras del esquema usadas
por DraftRequest, DraftResponse y ErrorResponse; no es una biblioteca JSON Schema
general. Cualquier evolución de esquema exige revisar consumidor y pruebas.
Se respeta que `1.0` es un integer de JSON Schema, mientras `"1"` y `1.5` no lo son
([referencia del proyecto JSON Schema](https://json-schema.org/understanding-json-schema/reference/numeric)).

La comprobación documental es mecánica. No prueba por sí sola la corrección de
un enunciado, explicación o distractor: las declaraciones de calidad ML siguen
necesitando evaluación del productor y revisión humana. No se convierte el DTO
en banco validado ni se invoca Abstract Factory para publicar automáticamente.

## Conexión Python pendiente

Debe acordarse con el responsable ML el commit exacto del contrato v1, ruta y
cabeceras, token de servicio independiente y su rotación, despliegue local o
proveedor autorizado, retención y prohibición de entrenamiento con documentos,
versión del modelo/plantilla, evaluación semántica y corpus de aceptación.

El productor debe entregar el servicio compatible y pasar las mismas fixtures,
demostrar contenido suficiente, calidad, saturación y terminación/cancelación del
trabajo a 30 s sin bloquear extracción ni salud. Cancelar HTTP desde Spring no
demuestra que un modelo remoto haya terminado. Hay que medir memoria/CPU antes
de cambiar los recursos de Compose; no se asume que un modelo cabe en los límites
actuales. No se modificó el módulo `services/content-ai` en el delta H5.

Tras ese acuerdo faltan una configuración HTTP revisada y su activación explícita,
pruebas productor/consumidor reales, revisión conjunta y despliegue selectivo.
Persistencia de borradores, caducidad, edición, publicación con confirmación,
idempotencia durable y una interfaz pública son trabajo posterior. No se añadieron
sus rutas propuestas al OpenAPI de producción ni a la allowlist BFF.

## Límites operativos

La admisión es por instancia y memoria; al escalar Spring necesitará coordinación
de cuota/admisión. No se promete cuota distribuida ni idempotencia de inferencia.
La revalidación final del snapshot detecta cambios durante la solicitud; una futura
publicación deberá volver a comparar la extracción y confirmar la revisión.
No hay almacenamiento nuevo ni migraciones Flyway en esta entrega. Identidades,
MFA, OIDC, Abstract Factory y la evaluación H3 conservan sus implementaciones.

Las pruebas, imágenes y preservación del despliegue se registran en
[H5_B_VALIDACION_20261119.md](H5_B_VALIDACION_20261119.md).

## Modern Web Guidance

Se consultó `accessibility` para revisar la resolución H4 existente. Se conservaron
los botones nativos, `aria-pressed` de selección y `aria-expanded` de texto:
“Manage toggle states”. No se introdujeron nuevos controles ni estilos.
