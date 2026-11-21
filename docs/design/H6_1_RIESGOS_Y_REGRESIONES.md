# H6-1: riesgos funcionales y regresiones bloqueantes

Estado de salida: **NO APTO PARA DESPLIEGUE**. El frontend productivo conserva los fallos observados en H6-0. H6-1 propone su corrección y permite revisar el diseño, sin aplicar los cambios ni certificar el comportamiento de SIARE.

## Bloqueos conocidos

| Riesgo | Causa comprobada | Corrección técnica propuesta | Evidencia necesaria antes de salir |
| --- | --- | --- | --- |
| Pérdida del banco | `ActivityBankEditor` se desmonta al cambiar `tab`; `raw`, tema y revisión están en estado local del editor | Mover el estado del borrador a un propietario estable de sesión académica, por usuario/materia/fuente. Separar vista y datos; una nueva fuente no destruye silenciosamente otro borrador | Banco idéntico tras herramienta/panel/breakpoint; revisión coherente con texto y fuente; regreso sin pérdida tras navegación cancelada |
| Pérdida de respuestas | `ActivityPlayer` se desmonta fuera de Catálogo; respuestas, celdas, índice, tiempo y sobre viven dentro | Estado estable por actividad/intento; cambiar presentación no crea otro intento. Renderizado responsive conserva identidad, o usa vistas controladas sobre el mismo estado | Respuestas/celdas/índice/duración preservados tras cambios. Envío en espera reintenta exactamente el mismo cuerpo y clave |
| Fecha inválida | `ActivitySummary` declara `createdAt`, pero el catálogo H3 real entrega `activityId`, `subjectId`, `type`, `title`, `available` | Separar DTO de catálogo y detalle. Omitir fecha que no existe; formatear fechas reales solo tras validarlas | Fixture del contrato real no produce `Invalid Date`, fecha inventada ni acceso a campo ausente |
| Distribución móvil | Paneles apilados y formulario abierto desplazan la tarea cientos de píxeles | Vista principal Aprendizaje y selector de panel; laterales se ocultan sin destruir estado; configuración/carga bajo demanda | Acceso directo al trabajo en 320–390 px, teclado y foco visibles, sin overflow; redimensionar no altera el intento |

Los dos primeros son bloqueos de pérdida de trabajo del estudiante. No se relajarán porque la revisión visual resulte satisfactoria. El fallo de fecha y la adaptación móvil también deben quedar resueltos en la implementación autorizada antes del despliegue H6.

## Propiedad del estado propuesta

Mantener un proveedor/controlador de sesión académica bajo el layout privado estable, después de la comprobación de identidad del servidor. No mover autenticación ni autorización al cliente. Clave de aislamiento: usuario autenticado, materia y actividad; borrar el estado al cerrar sesión o cambiar de identidad y no exponerlo a otra cuenta.

```text
Sesión académica (propietario estable, independiente del viewport)
  materia[id]
    selectedSourceId
    activePanel / activeTool (presentación)
    bankDraft[sourceId | external]
      raw, topic, type, count, gridSize
      reviewedFingerprint, sourceFingerprint, dirty
    activity[activityId]
      answers, crosswordCells, index, startedAt, dirty
      frozenSubmission?, status, confirmedEvaluation?
```

Las respuestas y celdas son datos de la sesión de actividad, no propiedades de un panel visual. El editor puede desmontarse si es una vista controlada y su borrador pertenece al controlador estable. Evitar `key` derivadas de tema, ancho, panel o herramienta. Una key nueva por cambio de usuario/actividad debe ser deliberada; no perder otro borrador al abrir una actividad distinta.

React asocia el estado con la posición y tipo del componente; retirar esa posición destruye su estado local. Por eso cambiar CSS no basta para corregir el flujo actual y duplicar un jugador para móvil/escritorio tampoco sirve. [Documentación de React sobre conservación de estado](https://react.dev/learn/preserving-and-resetting-state).

Conservar el banco por fuente evita asociar silenciosamente preguntas revisadas a otro documento. Cambiar JSON, tema, cantidad, tipo, fuente o huella de fragmentos invalida la revisión humana correspondiente, sin borrar el texto escrito. La actividad ya creada mantiene su propia procedencia; no se reescribe su `documentId` al seleccionar otra fuente.

### Envío e idempotencia

Al enviar, congelar una sola vez respuestas, duración y `idempotencyKey`, de acuerdo con la frontera H3 existente. El sobre y su estado permanecen en el controlador estable hasta recibir una evaluación autorizada. Un bloqueo síncrono/ref evita doble mutación durante clics rápidos; el estado de interfaz comunica pending sin ser la única protección.

Ante timeout, error de red o respuesta perdida, mantener el sobre completo y ofrecer reintento explícito del mismo cuerpo. No generar otra clave, recalcular duración, modificar respuestas congeladas ni enviar automáticamente al cambiar de panel. Guardar y evaluar siguen siendo responsabilidad de Spring.

Ver fuentes o cambiar de panel puede permitirse durante pending si no modifica el sobre. Cambiar de actividad, materia, cuenta o ejecutar una acción destructiva necesita una política expresa que impida abandonar el intento sin resolver. El modelo deberá contemplar respuestas tardías, solicitudes concurrentes y cancelación de una navegación; no transferir un resultado a otra actividad activa.

### Recarga, cierre y sesión expirada

Estado React estable protege las transiciones internas; no garantiza recuperación después de recarga, cierre abrupto, fallo de proceso o desconexión de cuenta. `beforeunload` es una advertencia limitada y no equivale a persistencia durable. Su uso se conserva para trabajo pendiente, junto con navegación interna controlada, sin prometer un guardado que no existe.

Antes del despliegue se debe acordar y probar el alcance de recuperación. Si se exige sobrevivir a una recarga, hace falta una decisión separada sobre almacenamiento de borradores/respuestas, consentimiento, retención, invalidación, aislamiento por usuario y eliminación. No guardar JWT, refresh, semillas MFA ni documentos originales en localStorage. No usar H5/V6 ni incorporar #8/#9 para resolverlo de forma implícita.

Mientras esa política no se defina, no publicar “guardado automáticamente” ni prometer ausencia de pérdida ante cierre/reload. La salida queda bloqueada si los recorridos acordados permiten perder trabajo silenciosamente. El prototipo declara su estado local y no satisface esa recuperación durable.

## Fechas y contrato del catálogo

Definir un tipo de resumen que refleje la respuesta de catálogo real y un tipo de detalle que contenga sus campos propios. Eliminar la dependencia de `createdAt` en las filas del catálogo. No convertir `undefined`, `null` o cadena vacía en fecha, ni usar la fecha actual como sustitución.

Para un instante recibido realmente del servidor, validar presencia/tipo/formato esperado y `Number.isFinite(Date.parse(value))` antes de formatear con `Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', … })`. La validación de formato debe corresponder al contrato UTC; no normalizar fechas locales ambiguas como si fueran instantes. `Date.parse` devuelve `NaN` si no reconoce una fecha válida; no todos los formatos no estándar son portables. [Referencia de Date.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse).

Los tests deben usar la respuesta efectiva de catálogo, no un objeto construido desde el tipo erróneo que incluya una fecha inventada. Cuando el detalle devuelve fecha válida, solo esa vista puede mostrarla. Transportes y persistencia permanecen en UTC.

## Matriz de regresión propuesta

Estas son pruebas pendientes para una implementación autorizada. Los resultados del prototipo se registran aparte y no se contabilizan como regresiones productivas aprobadas.

| ID | Preparación y acción | Aserción de aceptación | Tipo y prioridad |
| --- | --- | --- | --- |
| ST-01 | Escribir tema y JSON, importar banco, cambiar Banco/Catálogo/Lectura y volver | Mismos valores y estado dirty; ninguna publicación involuntaria | Componente + navegador; bloqueante |
| ST-02 | Validar y revisar banco, cambiar panel y tamaño | Revisión conservada si nada cambia; editar fuente/contenido la invalida sin borrar el borrador | Componente + navegador; bloqueante |
| ST-03 | Marcar varias preguntas, cambiar herramienta y volver | Mismas respuestas, índice y hora de inicio | Componente + navegador; bloqueante |
| ST-04 | Escribir celdas de crucigrama, abrir fuente, cambiar a móvil y volver | Mismas letras/cruces y actividad; foco recuperable | Navegador; bloqueante |
| ST-05 | Reducir/ampliar 1440/1024/390/320 con banco y actividad editados | No se duplica controlador/jugador; no se reinicia estado | Navegador; bloqueante |
| ST-06 | Spring guarda intento; se pierde su respuesta; cambiar panel y reintentar | Mismo JSON, clave y duración; un intento durable y resultado autorizado idéntico | Integración real + navegador; bloqueante |
| ST-07 | Clic doble en Enviar y respuesta tardía tras cambiar herramienta | Sin nueva clave ni intento duplicado; el resultado queda asociado a su actividad | Integración; bloqueante |
| ST-08 | Intentar salir/cambiar materia con trabajo; cancelar | Ruta, respuestas y borrador intactos; cancelar no envía ni archiva | Navegador; bloqueante |
| ST-09 | Recargar/cerrar conforme a la política de recuperación acordada | Se recupera el trabajo exigido o se aplica la protección aceptada, sin promesas falsas | Navegador; bloqueo hasta definir alcance |
| ST-10 | Usuario A con borrador; logout/login usuario B | B no puede recuperar datos ni estado de A; servidor preserva autorización | Integración + navegador; bloqueante |
| DT-01 | Catálogo con DTO real sin createdAt | No hay fecha, `Invalid Date` ni relleno con “hoy” | Contrato + componente; bloqueante |
| DT-02 | Fecha de detalle UTC válida, vacía, ausente, inválida y zona distinta | Solo se formatea la válida; misma representación prevista de zona, sin error de render | Unitaria + componente |
| UX-01 | Tab/Shift+Tab en shell, fuente, actividad y selector móvil | Orden lógico; panel oculto no recibe foco; controles/foco no quedan bajo barra o teclado | Navegador + teclado manual; bloqueante |
| UX-02 | Selector y herramientas en 320/375/390/768/1024/1366/1440/1920 y zoom real 200 % | Centro utilizable, nombres sin perderse, sin overflow del documento | Navegador + revisión visual |
| UX-03 | Tema claro/oscuro, reduced motion, forced colors, blur no disponible | Contrastes y estados legibles; control nativo visible; sin movimiento innecesario | Contraste + navegador + revisión manual |
| H4-01 | Subir/procesar con fuente en cuarentena/PROCESSING/FAILED/READY | Solo READY seleccionable/descargable; reintento y lease preservados | Regresión documental real; bloqueante |
| H4-02 | C2PA y OCR de fixtures autorizadas, descargar original | Advertencias claras, texto escapado, mismos bytes; sin iframe/object/embed de original | Regresión documental real; bloqueante |
| H3-01 | Crear desde banco revisado, completar Quiz/Crucigrama, recuperar intento | Cinco operaciones H3, límites y paginación; nota solo del servidor | Integración + navegador; bloqueante |
| ID-01 | Login/sesión/refresh/MFA/OIDC/admin según rol | Cookies HttpOnly/CSRF/allowlist y MFA preservados; cancelaciones no mutan | Suites existentes + revisión; bloqueante |

La suite H4 ya tiene un caso de respuesta perdida; debe ampliarse con cambios de herramienta/panel para detectar el desmontaje actual. Las pruebas de estado no deben limitarse a verificar que un array se copia: tienen que ejercitar el recorrido que pierde el trabajo y comprobar el resultado servidor cuando corresponda.

## Independencia y despliegue futuro

H6 parte de main `c8f9344`; este entregable solo añade documentos/prototipos. No se cambia `services/`, `frontend/`, Compose, `.env`, claves o módulos de compañeros. La persistencia de borradores H5 y V6 de #9 no se incorpora; #8 sigue siendo una línea de trabajo independiente. No se necesitan endpoints nuevos para representar el catálogo real ni para conservar estado durante cambios de panel.

Una implementación futura autorizada deberá pasar TypeScript, build, pruebas aisladas y suites e2e pertinentes, además de la matriz anterior. Solo entonces procede aplicar los controles oficiales, conservar una imagen de reversión, reconstruir/recrear selectivamente frontend y comprobar nueve servicios healthy y recorridos en 3100. La captura de una maqueta, un build o una imagen de prueba no acredita ese despliegue.

## Limitaciones conocidas de esta fase

La revisión actual cubre Chromium local, geometría, tema, controles de maqueta, ausencia de red y contraste calculado. No valida Safari/Firefox, lector de pantalla, zoom real, teclado virtual, recuperación durable ni el rendimiento del frontend Next.js. El menú popover y tooltip necesitan validación completa de accesibilidad/fallback antes de producción. La rejilla de crucigrama dibuja composición y acepta letras; no sustituye la navegación H4.

La propuesta puede aprobarse visualmente sin levantar estos bloqueos funcionales. Autorizar H6-2/H6-3 tampoco implica autorizar un despliegue o fusionar los PR.
