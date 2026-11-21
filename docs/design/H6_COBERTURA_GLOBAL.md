# H6: inventario y cobertura global Nexo

Actualización vigente de Apariencia, 21 de noviembre de 2026: **15 rutas de pantalla, 5 manejadores técnicos y 43 casos internos/transversales**, 58 filas en la matriz. R15 es `/configuracion/apariencia`; AP01–AP07 cubren navegación y preferencias. El inventario de 14 rutas que figura más abajo corresponde a la base histórica del 19 de noviembre. Ver [informe de Apariencia](H6_APARIENCIA_INFORME.md).

Fecha de revisión: 19 de noviembre de 2026, America/Bogota. Rama de trabajo: `feat/h6-design-audit`, base `c8f934492f0cc7809282657270df34b4474915ca`.

Esta entrega presenta la cobertura antes de implementar, conforme a la última solicitud: «Antes de continuar con implementaciones masivas, presentar el inventario de pantallas y la estrategia de cobertura para verificar que no se omita ninguna ruta». La implementación H6-2 a H6-7 sigue pendiente; las capturas de H6-0 y del prototipo no acreditan pantallas productivas rediseñadas.

La decisión vigente es **A, Cuaderno abierto**, exclusivamente para el espacio académico. Nexo se aplicará a toda la web. Esta decisión sustituye las referencias a elegir A/B de los documentos históricos; no es necesario volver a elegir distribución. Los acabados y las regresiones conservan sus revisiones por etapa.

## Base y fuentes

Se enumeraron los archivos de `frontend/src/app` tanto en el checkout habitual como en `.worktrees/h6/frontend/src/app`: ambos tienen **14 páginas, 5 manejadores técnicos, 2 layouts, 2 fronteras de error y 2 estados de carga explícitos**. La base H6 incorpora las actividades H4: `git diff 697621e c8f9344 -- frontend services` no presenta diferencias. El checkout habitual `fix/document-compatibility-isolation`, `acba280`, es anterior y tiene correcciones locales que se preservan.

Las referencias consultadas son [inventario H6-0](H6_INVENTARIO.md), [auditoría H6-0](H6_AUDITORIA_UX.md), [sistema H6-1](H6_1_SISTEMA_DISENO.md), [alternativa A](H6_1_ALTERNATIVAS.md), [riesgos](H6_1_RIESGOS_Y_REGRESIONES.md), [tokens del prototipo](h6-1/tokens.json) y [adaptación SIARE de DakaDesing](H6_SKILLS_SIARE.md). Se inspeccionó la captura A clara en escritorio. La identidad se contrastó con los [tokens originales de Nexo](https://github.com/SttivGG/Facturacion-hexagonal/blob/main/frontend/src/styles/tokens.css).

Actualmente existe `/configuracion/apariencia`. No hay rutas independientes de edición de perfil, documentos, Quiz, Crucigramas o resultados. El perfil se cubrirá con nombre/correo ya disponibles desde la identidad autenticada y acceso a `/seguridad`; las preferencias visuales, mediante un control compartido de tema. No se añadirá edición de datos personales sin contrato existente. Documentos y actividades son vistas de `/materias/[id]` y se inventarían por separado más abajo.

## Composiciones compartidas

Los nombres siguientes describen componentes previstos, todavía no implementados.

| Composición | Destinos | Estructura y componentes comunes |
| --- | --- | --- |
| `PublicShell` | Portada | Marca, cabecera pública compacta, contenido abierto, acciones de acceso y tema. |
| `AuthShell` | Login, registro, recuperación, MFA y renovación | Identidad Nexo, superficie de formulario y contexto lateral opcional en escritorio; una columna en móvil. `AuthForm`, `Field`, `Notice`, `ProviderButton`, `ThemeControl`. |
| `AppShell` | Inicio, materias, seguridad, sesiones y administración | Rail de iconos con nombres accesibles, cabecera flotante, breadcrumbs, menú de cuenta y navegación adaptable por rol. |
| `WorkspaceShell` | Materia | Variante A dentro de `AppShell`: Fuentes, Aprendizaje dominante y Estudio. Un controlador académico estable alimenta las vistas. |
| `FeedbackShell` | 404 y error inesperado | Identidad, mensaje y acción de recuperación; reutiliza superficies y botones del sistema, sin exigir sesión para renderizar. |

## Las 15 rutas de pantalla

Fuentes relativas a `frontend/src/app/` de la base H6. `(student)` es un grupo de rutas, no parte de la URL. Todas las rutas privadas conservan comprobación de identidad en servidor y autorización de Spring.

| ID | Ruta | Archivo | Módulos actuales y estados que se conservan | Composición / etapa |
| --- | --- | --- | --- | --- |
| R01 | `/` | `page.tsx` | Bienvenida, acceso/registro y salud real UP/DOWN. Actualizar textos según capacidades entregadas. | `PublicShell`, H6-4 |
| R02 | `/login` | `login/page.tsx` | `AuthForm`, `FederatedLogin`; credenciales, pending, validación, alta completada, sesión caducada y errores OIDC. | `AuthShell`, H6-2/4 |
| R03 | `/registro` | `registro/page.tsx` | `AuthForm register`, `FederatedLogin`; nombre, correo, contraseña, validación y registro cerrado por servidor. | `AuthShell`, H6-2/4 |
| R04 | `/recuperar` | `recuperar/page.tsx` | `PasswordRecoveryForm`; respuesta genérica, error y envío. No prometer entrega SMTP no confirmada. | `AuthShell`, H6-4 |
| R05 | `/recuperar/confirmar` | `recuperar/confirmar/page.tsx` | `PasswordRecoveryForm complete`; token en fragmento, nueva contraseña, confirmación, token ausente/inválido/expirado y éxito. | `AuthShell`, H6-4 |
| R06 | `/login/mfa` | `login/mfa/page.tsx` | `MfaPanel challenge`; TOTP, código offline, expiración y `?configurar=1` para enrolamiento obligatorio. | `AuthShell`, H6-4 |
| R07 | `/sesion/renovar` | `sesion/renovar/page.tsx` | `SessionRenewal`; progreso, renovación/redirección al destino validado y sesión irrecuperable. | `AuthShell`, H6-4 |
| R08 | `/inicio` | `(student)/inicio/page.tsx` | Identidad real y navegación a materias/creación. Sin contadores o recomendaciones inventadas. | `AppShell`, H6-2/4 |
| R09 | `/materias` | `(student)/materias/page.tsx` | `SubjectsList`; carga, vacío, error/reintento, filtros activas/archivadas/todas y conteo real. | `AppShell`, H6-4 |
| R10 | `/materias/nueva` | `(student)/materias/nueva/page.tsx` | `SubjectForm`; campos, validaciones, error, guardado y apertura de materia creada. | `AppShell`, H6-4 |
| R11 | `/materias/[id]` | `(student)/materias/[id]/page.tsx` | `SubjectWorkspace`, `SubjectDocuments`, `SubjectForm`, `ActivityPanel`, `ActivityBankEditor`, `ActivityPlayer`, `EvaluationView`. Incluye carga, error y materia archivada. | `WorkspaceShell` A, H6-3 |
| R12 | `/seguridad` | `(student)/seguridad/page.tsx` | `MfaPanel`, `ConnectedIdentities`; enrolar/confirmar/desactivar/reponer códigos, reautenticar, vincular/desvincular y retorno `?oidc=vinculada`. Resumen de perfil con identidad existente. | `AppShell`, H6-4 |
| R13 | `/sesiones` | `(student)/sesiones/page.tsx` | `SessionsPanel`; carga/error, fechas y cierre de una/otras/todas las sesiones. | `AppShell`, H6-4/5 |
| R14 | `/administracion` | `(student)/administracion/page.tsx` | `AdministrationPanel`; denegación, ADMIN por ámbito, SUPERADMIN, usuarios/roles, ámbitos, registro público, auditoría y conflicto de versión. | `AppShell`, H6-4 |

| R15 | `/configuracion/apariencia` | `(student)/configuracion/apariencia/page.tsx` | Tema, seis fondos, cristal, blur, velo, restauración, almacenamiento bloqueado y sincronización. | `AppShell`, Apariencia |

## Rutas técnicas y fronteras de composición

Estas cinco rutas no son páginas para rediseñar. Se conservan sus contratos y se comprueba que sus salidas se expresen en las pantallas Nexo correspondientes.

| Ruta técnica | Archivo en App Router | Responsabilidad / cobertura visible |
| --- | --- | --- |
| `/api/bff/[...path]` | `api/bff/[...path]/route.ts` | JSON permitido, CSRF, cookies HttpOnly, renovación, materias, documentos, cinco operaciones H3 e identidad/administración. Errores se representan con `Notice` y validación en contexto. |
| `/api/files/[...path]` | `api/files/[...path]/route.ts` | Carga/descarga, límites, streaming y políticas documentales; progreso y errores en Fuentes. |
| `/api/oidc/start` | `api/oidc/start/route.ts` | Inicio POST de Google/GitLab y vínculo explícito; controles en login/registro/seguridad. |
| `/api/oidc/callback/[provider]` | `api/oidc/callback/[provider]/route.ts` | Callback, contexto y redirecciones; éxito, cancelación y error se muestran en login, MFA o seguridad. No se simula una pantalla del proveedor. |
| `/api/health` | `api/health/route.ts` | Salud de frontend/Spring. No equivale a verificar nueve servicios ni a aprobar H6. |

| Archivo transversal | Cobertura exigida |
| --- | --- |
| `layout.tsx` | Urbanist global, idioma español, tema inicial y enlace de salto. |
| `(student)/layout.tsx` | `AppShell`, autorización servidor, navegación por rol y cierre de sesión. |
| `error.tsx` | Error recuperable, botón reintentar y enlace de acceso, en ambos temas. |
| `not-found.tsx` | 404, retorno seguro y navegación por teclado, en ambos temas. |
| `(student)/sesiones/loading.tsx` | Skeleton/estado de carga con anuncio accesible y medidas estables. |
| `(student)/administracion/loading.tsx` | Comprobación de autorización sin anticipar datos o controles privilegiados. |

## Matriz de aceptación por ruta

Estado de todas las filas: **inventariada; migración productiva pendiente**. `P` significa pendiente de capturar o probar después de implementar. Los componentes son el destino previsto. No se trasladan resultados históricos a estas columnas.

La [matriz CSV de aceptación](H6_MATRIZ_ACEPTACION.csv) reúne las 50 filas de rutas y estados con todas las columnas solicitadas, lista para completar durante la implementación.

| ID / ruta | Componentes Nexo previstos | Captura clara | Captura oscura | Responsive | Funcional | Problema pendiente principal |
| --- | --- | --- | --- | --- | --- | --- |
| R01 `/` | `PublicShell`, `Button`, `Notice` | P | P | P | P | Identidad antigua y textos de fase. |
| R02 `/login` | `AuthShell`, `Field`, `ProviderButton`, `Notice` | P | P | P | P | Unificar acceso, error y sesión expirada. |
| R03 `/registro` | `AuthShell`, `Field`, `ProviderButton`, `Notice` | P | P | P | P | Identidad antigua; mantener validación y registro cerrado. |
| R04 `/recuperar` | `AuthShell`, `Field`, `Notice` | P | P | P | P | Unificar composición y respuesta genérica. |
| R05 `/recuperar/confirmar` | `AuthShell`, `Field`, `Notice` | P | P | P | P | Cobertura visual de token ausente y expirado. |
| R06 `/login/mfa` | `AuthShell`, `Field`, `Notice`, `Surface` | P | P | P | P | Tema y estados sin exponer material MFA en evidencias. |
| R07 `/sesion/renovar` | `AuthShell`, `LoadingState`, `Notice` | P | P | P | P | Renovación y retorno deben conservar comportamiento. |
| R08 `/inicio` | `AppShell`, `PageHeader`, `Surface`, `Button` | P | P | P | P | Identidad antigua y textos desactualizados. |
| R09 `/materias` | `AppShell`, `SubjectCard`, `Select`, `EmptyState` | P | P | P | P | Filtros, carga y vacío en ambos temas. |
| R10 `/materias/nueva` | `AppShell`, `PageHeader`, `Field`, `Button` | P | P | P | P | Preservar valores y errores al guardar. |
| R11 `/materias/[id]` | `WorkspaceShell`, `SourceList`, `StudyTools`, jugadores | P | P | P | P | Pérdida de trabajo, tarea lateral y recuperación tras recarga. |
| R12 `/seguridad` | `AppShell`, `AccountSummary`, `Field`, `Notice`, diálogo | P | P | P | P | Identidades, MFA y resumen de perfil uniforme. |
| R13 `/sesiones` | `AppShell`, `SessionList`, `Notice`, confirmación | P | P | P | P | Acciones sensibles y estados de cancelación. |
| R14 `/administracion` | `AppShell`, `DataList`, `Field`, `Select`, `Notice` | P | P | P | P | Cubrir roles autorizados y denegación; conservar límites. |

## Matriz de vistas y estados internos

Todas estas filas tienen rediseño, captura clara, captura oscura, responsive y prueba funcional **pendientes**. Su separación evita que una captura de la página inicial o del contenedor oculte una vista heredada. Los IDs identifican la evidencia futura.

| ID | Ruta / pantalla o estado | Componentes previstos | Prueba que debe pasar / problema pendiente |
| --- | --- | --- | --- |
| A01 | Login: credenciales erróneas y errores de campo | `Field`, `Notice` | Conservar valores, enfocar el error adecuado y evitar doble envío. |
| A02 | Login: registro completado / sesión caducada | `AuthShell`, `Notice` | Mensaje correcto según query y acceso funcional. |
| A03 | Google y GitLab: disponibilidad, cancelación, error y vínculo requerido | `ProviderButton`, `Notice` | Cada proveedor mantiene su estado real y redirección; no convertir error en éxito. |
| A04 | MFA: desafío, código offline y configuración requerida | `Field`, `Surface`, `Notice` | Recorrido de autenticación real y expiración, sin capturar secretos. |
| A05 | Recuperación: solicitud / token ausente, inválido o expirado | `Field`, `Notice` | Respuesta genérica y rechazo real; probar éxito con proveedor de correo controlado. |
| W01 | Materia: bienvenida, carga, error y no disponible | `WorkspaceShell`, `LoadingState`, `EmptyState` | Reintentar sin bucles ni pérdida de contexto; autorización servidor. |
| W02 | Fuentes: listado, búsqueda y selección única | `SourceList`, `SearchField`, `StatusBadge` | Búsqueda local distingue filtro vacío de falta de documentos; fuente coherente. |
| W03 | Fuentes: cargar archivo y progreso | `UploadDialog`, `Progress`, `Field`, `Notice` | Formatos/límites actuales; selección por teclado además de arrastre; cancelación sin subir. |
| W04 | Fuentes: cuarentena, PROCESSING, READY, FAILED y lease | `StatusBadge`, `Notice`, `Button` | Procesar/reintentar/descargar solo según políticas vigentes; no inventar porcentajes. |
| W05 | Lectura documental, C2PA y OCR | `DocumentReader`, `Notice`, `StatusBadge` | Texto escapado y advertencias; original preservado sin visor embebido inseguro. |
| W06 | Catálogo y paginación | `ActivityList`, `EmptyState`, `Button` | Cargar más sin duplicar; omitir fecha que el DTO no entrega; nunca `Invalid Date`. |
| W07 | Preparar/importar/validar/revisar/publicar banco | `BankEditor`, `Field`, `Notice` | Fuente y revisión coherentes; cambios invalidan revisión sin borrar texto; creación real. |
| W08 | Quiz central | `QuizPlayer`, `QuestionOption`, `Progress` | Respuestas, índice y duración sobreviven a herramienta, panel y breakpoint. |
| W09 | Crucigrama central | `CrosswordPlayer`, `ClueList`, `Field` | Letras, dirección y cruces se conservan; flechas/Enter/Retroceso y tacto operativos. |
| W10 | Envío en curso, timeout y respuesta perdida | `SubmissionStatus`, `Notice`, `Button` | Congelar cuerpo, duración y clave; reintentar exactamente el mismo envío; un intento real. |
| W11 | Resultado y retroalimentación | `EvaluationView`, `StatusBadge`, `Button` | Nota y feedback solo de Spring; nuevo intento deliberado, sin reutilizar respuesta evaluada como solución local. |
| W12 | Consulta de intento y enlace directo | `AttemptLookup`, `Field`, `EvaluationView` | `?activity=…&attempt=…` y propiedad/materia; no inventar historial global. |
| W13 | Editar, confirmar/cancelar archivo y materia archivada | `SubjectForm`, `Dialog`, `Notice` | Cancelar conserva materia y trabajo; archivada mantiene solo consulta según negocio. |
| W14 | Recarga, retorno a materia, sesión expirada y cambio de cuenta | `RecoveryNotice`, controlador de estado | Recuperación conforme a política cifrada; aislamiento A/B; ningún secreto o solucionario persistido en claro. |
| I01 | Resumen de perfil y menú de cuenta | `AccountSummary`, `AccountMenu` | Nombre/correo existentes; enlaces a seguridad/sesiones y cierre funcional. |
| I02 | Seguridad: estado MFA, QR, confirmación y códigos | `Surface`, `Field`, `Notice` | Material solo durante flujo permitido; evidencias sin semillas, URI o códigos reales. |
| I03 | Seguridad: desactivar MFA, renovar códigos y reautenticar | `Field`, `Dialog`, `Notice` | Mantener verificación y revocación actuales; cancelación no muta. |
| I04 | Identidades vinculadas, vincular y desconectar | `IdentityList`, `ProviderButton`, `Dialog` | Consentimiento explícito, sesión reciente y última vía de acceso protegida. |
| I05 | Sesiones: una, otras y todas; error/cancelación | `SessionList`, `Dialog`, `Notice` | Solo cerrar tras confirmar; fechas reales; sesión actual y expiración coherentes. |
| I06 | Preferencia claro / oscuro / sistema | `ThemeControl` compartido | Primera carga, persistencia solo visual y navegación sin flash de tema incorrecto. |
| D01 | Administración: USER o MFA/autorización insuficiente | `AccessState`, `Notice` | La denegación se representa sin datos privilegiados ni elevación de permisos. |
| D02 | Administración: ADMIN dentro de ámbito | `DataList`, `Field`, `Notice` | Solo usuarios/acciones actuales del ámbito; servidor conserva autoridad. |
| D03 | Administración: SUPERADMIN, roles y ámbitos | `DataList`, `Select`, `Field`, confirmación | Mantener restricciones sobre SUPERADMIN, versión y revocación de sesiones. |
| D04 | Administración: crear ámbito y registro público | `Field`, `Button`, `Notice` | Mutación real, pending y conflicto de versión; no éxito anticipado. |
| D05 | Administración: auditoría reciente, vacío y error | `DataList`, `EmptyState`, `Notice` | Fechas/datos reales y límite existente; no agregar paginación que la API no ofrece. |
| X01 | Error inesperado y recuperación | `FeedbackShell`, `Notice`, `Button` | Reintentar y navegar por teclado sin depender de servicios sanos para dibujar el error. |
| X02 | Página inexistente | `FeedbackShell`, `Button` | 404 claro/oscuro y retorno funcional. |
| X03 | Loading de sesiones y de administración | `LoadingState`, skeleton | Anuncio accesible; ningún control privilegiado antes de autorización. |
| X04 | Shell, menú contextual y navegación móvil | `AppShell`, `Breadcrumbs`, `IconButton` | Accesos por rol, foco visible, retorno y logout; barra académica solo en workspace. |
| X05 | Diálogos, menús, tooltips y confirmaciones | Capa compartida de overlays | Título/nombre accesible, Escape, foco/restauración, pending y cancelación sin peticiones. |
| X06 | Botones, campos, selectores, listas/tablas y estados | Primitivas compartidas | Normal/hover/foco/disabled/pending/error/éxito; contraste compuesto y movimiento reducido. |

El inventario vigente suma **43 casos internos/transversales**, además de las 15 rutas: los 36 históricos de esta sección y AP01–AP07 documentados en Apariencia. Cada caso requiere evidencia en ambos temas y su prueba indicada; una misma captura puede acreditar varios estados únicamente si se identifican y son visibles. No se marca un caso como aprobado solo porque lo cubre un estilo global.

## Registro de evidencia de H6-6

Al implementar se sustituirá cada `P` de la matriz por un enlace a un archivo existente o por un resultado con referencia al informe. Las capturas se guardarán en `evidencias/h6-6/<ID>/<tema>-<ancho>x<alto>-<estado>.png`; los resultados funcionales indicarán fixture o servicio real, fecha, navegador, revisión y limitaciones. Los casos internos tendrán las mismas columnas de la matriz principal al registrar sus resultados.

La matriz de viewports incluye 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 390×844, 375×812 y 320×812. Se comprobarán además zoom real 200 %, teclado, foco no tapado, movimiento reducido y tema del sistema. La rejilla del crucigrama puede desplazarse dentro de una región etiquetada; el documento de la página no debe desbordarse horizontalmente.

Las pruebas de MFA, recuperación y administración usarán cuentas/fixtures controladas. Las capturas no incluirán contraseñas, tokens, QR/semillas TOTP ni códigos offline. Google/GitLab controlados y login externo real tendrán resultados separados; la recuperación SMTP no se marcará aprobada por ver un mensaje de solicitud.

## Estado de esta entrega

La [estrategia de implementación](H6_ESTRATEGIA_IMPLEMENTACION.md) detalla etapas, componentes, política de recuperación propuesta y despliegue. Aquí se completa el inventario previo solicitado. Ninguna ruta productiva se declara migrada o aprobada en esta revisión; H6 continúa abierto.
