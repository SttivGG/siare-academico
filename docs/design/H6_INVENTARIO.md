# H6-0: inventario de pantallas, componentes y flujos

Base: main `c8f9344`, con código frontend/servicios idéntico al desplegado `697621e`. Todas las rutas se expresan relativas a `http://127.0.0.1:3100`. La auditoría y sus límites están en [H6_AUDITORIA_UX.md](H6_AUDITORIA_UX.md).

## Pantallas del App Router

| Ruta | Propósito y módulos | Estados/controles que deben conservarse | Evidencia H6-0 |
| --- | --- | --- | --- |
| `/` | Portada pública; salud de Spring | Acceso/registro; salud UP/DOWN sin datos ficticios | Navegador, captura |
| `/login` | `AuthForm`, `FederatedLogin` | Error de credenciales/campos, envío, alta completada, sesión expirada, errores OIDC, disponibilidad por proveedor | Navegador, capturas escritorio/móvil |
| `/registro` | `AuthForm register`, acceso federado | Nombre, correo, frase, validaciones, alta, registro cerrado según backend | Navegador, captura de formulario; cuenta sintética creada por BFF |
| `/recuperar` | `PasswordRecoveryForm` | Solicitud, respuesta genérica, error, envío | Navegador, captura; sin enviar correo |
| `/recuperar/confirmar` | `PasswordRecoveryForm complete` | Token y contraseña nueva, error de token, éxito | Código; sin token real |
| `/login/mfa` | `MfaPanel challenge` | Desafío provisional, TOTP/código offline, enrolamiento requerido, error y expiración | Código; sin enrolar factor |
| `/sesion/renovar` | `SessionRenewal` | Renovación en curso, éxito/redirección, expiración, reintento | Código; no se forzó caducidad |
| `/inicio` | Inicio privado y enlaces a materias | Identidad real autorizada, crear/consultar materia, error de sesión | Navegador, captura |
| `/materias` | `SubjectsList` | Cargando, fallo/reintento, vacío, filtros activas/archivadas/todas, conteo real, tarjetas | Navegador, capturas |
| `/materias/nueva` | `SubjectForm` | Nombre/descripción, validación, pendiente, errores, redirección al guardar | Navegador, captura; materia sintética creada por BFF |
| `/materias/[id]` | `SubjectWorkspace` | Materia cargando/error; fuente, actividad, evaluación, edición, confirmar/cancelar archivo y solo consulta archivada | Navegador; ocho resoluciones y capturas de herramientas |
| `/seguridad` | `MfaPanel`, `ConnectedIdentities` | MFA activo/pendiente/no configurado; reautenticación; vinculación explícita; desconexión; mensajes OIDC | Navegador, cuenta USER sin factor; resto por código |
| `/sesiones` | `SessionsPanel` | Listado, fechas, carga/error; cerrar una/otras/todas; expiración | Navegador, captura; sin revocar sesiones |
| `/administracion` | `AdministrationPanel`, comprobación servidor | Restricción de acceso; ADMIN por ámbito; SUPERADMIN, parámetros, auditoría y versiones de asignación | Navegador: denegación USER; pantalla autorizada por código |

El inventario vigente incorpora 15 rutas de pantalla, incluida `/configuracion/apariencia`; ver [Apariencia](H6_APARIENCIA_INFORME.md). La base histórica tenía 14 rutas de pantalla, más `not-found.tsx`, `error.tsx` y cargas específicas de sesiones/administración. `layout.tsx` raíz define idioma y enlace de salto; `(student)/layout.tsx` comprueba sesión/identidad y comparte navegación, contenido y pie.

No existen pantallas independientes de perfil, configuración de apariencia, documentos, Quiz, Crucigrama o resultados. Los últimos cuatro son estados dentro de la materia. H6 debe especificar si necesita navegación propia antes de introducir rutas; no debe presentar rutas inexistentes como entregadas.

## Estados internos del workspace

| Área actual | Comportamiento disponible | Estado y dependencia | Destino solicitado, aún sin aprobar |
| --- | --- | --- | --- |
| Documentos | Elegir/arrastrar un archivo, validar formato/tamaño, subir con progreso | File e input, busy, límites reales; API files y renovación | Fuentes; carga bajo demanda |
| Documentos | Listar por fecha descendente, actualizar, procesar/reintentar | UPLOADED, PROCESSING, lease vencido, READY, FAILED; sondeo 2,5 s mientras procesa | Lista compacta, búsqueda, plegado |
| Documentos | Descargar original y seleccionar fuente | Solo READY; en archivada no se selecciona para nueva actividad | Mantener política y selección al cambiar panel |
| Documentos | Consultar fragmentos escapados, C2PA/OCR/archivos asociados | Vista de texto en fila; sin facsímil PDF ni verificación criptográfica C2PA | Lectura documental en el centro |
| Aprendizaje | Bienvenida, actividad reciente, última evaluación consultada | Datos en memoria del workspace; sin analítica histórica | Estado central según contexto real |
| Aprendizaje | Editar nombre/descripción y archivar | Formulario abierto; confirmación en línea, cancelación y pendiente | Configuración bajo demanda |
| Actividades / Catálogo | Listar, actualizar, cargar más, abrir actividad | Paginación cursor H3; disponible/vacío/cargando/error | Estudio compacto; tarea en centro |
| Actividades / Preparar banco | Tipo, tema, cantidad, cuadrícula, JSON, importar, añadir entrada, validar, revisar, publicar | Banco estructurado, revisión humana, citas/fragmentos si hay fuente; fuente externa sin documento también admitida | Editor avanzado central; no sustituir por ML ficticio |
| Actividades / Quiz | Opciones por pregunta, anterior/siguiente, omisiones, envío | Respuestas, índice, tiempo, sobre idempotente y confirmación de Spring | Jugador central persistente |
| Actividades / Crucigrama | Celdas, pistas, dirección, flechas/Enter/Retroceso | Celdas y foco, rejilla desplazable, envío | Jugador central con teclado y tacto |
| Actividades / Evaluación | Porcentaje/aciertos, feedback e ítems de Spring; nuevo intento | No se calcula resultado autoritativo en cliente | Centro, conservando resultado real |
| Actividades / Intentos | Consultar por ID actividad/intento y enlaces consultados | H3 no ofrece historial global; filtros de propiedad/materia | Consulta guiada sin inventar un listado |

La fuente seleccionada es única en H4. El plan habla de fuentes seleccionadas en plural: H6-3 deberá decidir si mantiene la selección única del contrato actual o si requiere otro alcance autorizado. No asumir generación multidocumento.

## Los 16 módulos de componentes

| Archivo en `frontend/src/components/` | Responsabilidad y reutilización |
| --- | --- |
| `student-nav.tsx` | Navegación por ruta/rol, cierre de sesión y error. Base para shell H6. |
| `auth-form.tsx` | Acceso/registro con campos, pending, error enfocable y errores de servidor. |
| `federated-login.tsx` | Google/GitLab, disponibilidad, confirmación de vínculo y redirección OIDC. |
| `password-recovery-form.tsx` | Solicitud y confirmación de recuperación. |
| `mfa-panel.tsx` | Estado, enrolamiento QR local, desafío, códigos y reautenticación. Incluye `EnrollmentQr`. |
| `connected-identities.tsx` | Listado, vínculo y confirmación de desconexión. |
| `session-renewal.tsx` | Pantalla de renovación y recuperación de sesión. |
| `sessions-panel.tsx` | Listado y revocaciones de sesiones propias. |
| `subjects-list.tsx` | Filtro, conteo, vacío, reintento y tarjetas. |
| `subject-form.tsx` | Alta/edición, validación, éxito/error y navegación. |
| `subject-workspace.tsx` | Materia y coordinación de fuente, actividad reciente y última evaluación. |
| `subject-documents.tsx` | Transporte de archivo, cuarentena, READY, fragmentos y avisos. |
| `activity-panel.tsx` | Catálogo, editor, consulta de intento y selección de actividad. |
| `activity-bank-editor.tsx` | Edición/importación, validación y revisión humana del banco. |
| `activity-player.tsx` | Quiz, `CrosswordGrid` y `EvaluationView`; respuestas y sobre de envío. |
| `administration-panel.tsx` | Usuarios/ámbitos, permisos/versiones, registro público y auditoría por rol. |

Los estilos reutilizables son clases globales (`button`, `field`, `notice`, `panel`, `badge`, etc.), no una biblioteca de componentes tipados. `globals.css` contiene estilos iniciales y overrides H4. No se encontraron dependencias de SweetAlert2, GSAP, shadcn o biblioteca de iconos en el manifiesto SIARE.

## Fronteras técnicas

| Capa | Responsabilidad que se preserva |
| --- | --- |
| Next.js 16.4.6 / React 19.3.1 / TypeScript 5.9.3 | App Router; comprobaciones de identidad en servidor; componentes interactivos en cliente; build standalone. |
| Tailwind 4.3.5 / CSS global | Tokens iniciales y overrides H4; Urbanist local dentro del workspace. |
| `api.ts`, `renew-session.ts` | Errores y peticiones JSON, renovación serializada; no trasladar tokens al localStorage. |
| `server-session.ts`, `session-policy.ts` | Cookies HttpOnly, acceso/refresh/desafío, protección de rutas y origen/CSRF. |
| `activity-policy.ts`, `activities.ts` | Allowlist de cinco operaciones H3, paginación, límites, tipos/validaciones y congelación del envío. El tipo del catálogo debe corregirse a su respuesta real en una fase autorizada. |
| `/api/bff/[...path]` | API JSON permitida: identidad, MFA, OIDC, materias, metadatos, texto, procesamiento, H3 y administración. Catálogo/creación H3 hasta 4 MiB, envío 64 KiB, otras mutaciones 16 KiB. |
| `/api/files/[...path]` | Límites, multipart y descarga autorizada; límite predeterminado de archivo 15 MiB. |
| `/api/oidc/start`, `/api/oidc/callback/[provider]` | Inicio POST con CSRF y callback protegido por contexto OIDC; no convertirlos en un formulario local ficticio. |
| `/api/health` | Salud Next.js/Spring; no sustituye comprobar los nueve servicios. |
| Spring H3 | Generación desde banco revisado, evaluación autoritativa, permisos y persistencia/idempotencia MySQL. |
| Flask / MongoDB | Extracción y fragmentos, originales aislados, cuarentena, OCR; preservar bytes C2PA. |
| Express / ClickHouse / ML | No dan métricas ni recomendaciones académicas operativas para esta UI. H5 #8/#9 permanece fuera de la base H6. |

## Navegación y conservación de estado

El flujo privado exige identidad antes de renderizar el shell. Desde Inicio se accede a Materias; crear abre la materia recién guardada. En materia, procesar habilita READY; la fuente puede apoyar un banco estructurado revisado; Spring crea la actividad, recibe el intento y devuelve su evaluación. Los resultados consultables usan `?activity=…&attempt=…`.

La autorización no se deriva de ocultar botones. Archivar mantiene la consulta y bloquea creación/procesamiento según reglas existentes. USER no recibe administración; ADMIN/SUPERADMIN necesitan MFA y autorización de backend. Cambiar rol, claves o identidades queda fuera de una prueba visual.

El rediseño debe conservar por materia la selección, el borrador del banco, las respuestas y celdas, el índice, la hora inicial y el sobre idempotente en espera. Ocultar un panel puede cambiar su presentación; no debe destruir ese estado. La navegación entre actividades/materias con trabajo pendiente requiere una decisión explícita y pruebas de cancelación. Esta especificación no autoriza guardar contenido sensible en almacenamiento persistente del navegador.

## Verificación futura por alcance

Los comandos disponibles son `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run build` y `npm.cmd run test:e2e` desde frontend. No existe script `lint` en este manifiesto. Playwright usa Chromium, base 3100, proyectos desktop 1440 × 1000 y mobile 375 × 812; los dos proyectos actuales no cubren por sí solos toda la matriz H6.

Las suites e2e existentes son `activities.spec.ts`, `phase-one.spec.ts`, `phase-two.spec.ts`, `identity.spec.ts`, `mfa.spec.ts` y `oidc.spec.ts`. Hay pruebas aisladas de políticas de actividad, sesión, documentos, salud, OIDC y rechazos de carga. Para H6-3 se necesitan regresiones de cambio de panel/pestaña/resolución que hoy no protegen los dos casos de pérdida de estado observados.

H6-6 debe completar las ocho resoluciones del plan, zoom real 200 %, temas, teclado, contraste compuesto, movimiento reducido y las regresiones críticas. La verificación de despliegue para cambios ejecutables seguirá `AGENTS.md`, con reconstrucción exclusiva de frontend cuando corresponda y nueve servicios healthy.
