# H6-4: cobertura Nexo de pantallas y estados internos

H6-4 completa las composiciones públicas, autenticación, Inicio, materias, cuenta, sesiones y administración con el sistema Nexo compartido. El workspace A conserva su controlador y recuperación cifrada. La preview efectiva está en http://127.0.0.1:3107; la instalación habitual de 3100 conserva sus nueve contenedores e imágenes.

La implementación visual está disponible para revisión. Las operaciones privilegiadas con ADMIN/SUPERADMIN real, la autenticación externa Google/GitLab, la entrega SMTP y la auditoría manual de accesibilidad siguen pendientes; las pruebas controladas de interfaz no los sustituyen.

## Revisión y entregables

- Rama `feat/h6-4-nexo-integral`, creada desde `731bad0e9d890d2072d05bd3755e02cc8761e85f`, HEAD verificado del PR #11 abierto y draft.
- Implementación inicial `cb6372f`; imagen final construida desde `cc6cd704a4f93227123afc796f3682315aba862f`. Los commits posteriores contienen pruebas y documentación; no cambian el código ejecutable de esa imagen.
- [PR #12 draft](https://github.com/SttivGG/siare-academico/pull/12) dirigido a `feat/h6-3-cuaderno-abierto`. No se fusiona ni se modifica el historial de main; #8, #9, #10 y #11 permanecen independientes.
- [Matriz de 50 casos](H6_MATRIZ_ACEPTACION.csv), [galería por caso y estado](evidencias/h6-4/README.md), [comparación con Nexo](H6_4_COMPARACION_NEXO.md), [pruebas por caso](evidencias/h6-4/pruebas.json), [runtime](evidencias/h6-4/runtime.json) e [integridad de capturas](evidencias/h6-4/capturas.json).

La entrega contiene 575 PNG con manifiesto SHA-256. Las 50 filas añaden componentes implementados, accesibilidad comprobada, omisiones y pendientes; cada captura enlazada existe.

## Cambios por grupo

| Grupo | Implementación y comportamiento comprobado |
| --- | --- |
| Público y acceso R01–R07, A01–A05 | Portada con composición Nexo y salud Spring consultada; login/registro uniformes, errores de campo relacionados, resumen enfocable y valores conservados. Recuperación usa Field/Button/Notice; diferencia token ausente, confirmación local y rechazo del servidor. Proveedores consultan disponibilidad real, muestran fallo y permiten reconsultar. MFA y renovación conservan sus endpoints, cookies y reglas. |
| Inicio y materias R08–R10 | Inicio con saludo auténtico y accesos a las herramientas existentes; sin porcentajes, recomendaciones, historial o actividad ficticios. Tarjetas con pasteles, búsqueda local por nombre/descripción y filtros sobre el único listado existente. Crear/editar usan Field/TextArea/Button, guardan errores y navegan a la materia creada. |
| Cuenta y seguridad R12–R13, I01–I06 | Resumen auténtico de nombre/correo, enlace a sesiones y disposición móvil legible. MFA, identidades y sesiones comparten superficies, listas y avisos. Confirmaciones nativas para desconectar, regenerar/desactivar MFA y cerrar una/otras/todas las sesiones. Cancelar/Escape no mutan; las confirmaciones esperan respuesta real. |
| Administración R14, D01–D05 | Denegación útil para USER; ámbitos, registro, usuarios y auditoría con formularios/listas Nexo. ADMIN conserva su ámbito y no recibe selectores de roles. Propia asignación y SUPERADMIN permanecen protegidas. Se confirma cada cambio sensible con su versión; 409 conserva valores y ofrece consulta explícita de la versión actual. Vacío, autorización insuficiente y error de auditoría tienen estados comprobados. |
| Transversal X01–X06 | Skeletons sin shimmer, TextArea compartido, fechas de identidad validadas en America/Bogota y confirmación con foco inicial en Cancelar. El error inesperado vuelve a consultar al servidor al reintentar; antes solo reiniciaba la frontera y podía repetir el mismo error. Menú móvil/cuenta, tema, 404, contraste, forced colors y movimiento reducido conservan sus regresiones. |

La búsqueda de materias no cambia el contrato ni añade peticiones. Se añadieron bloqueos síncronos de presentación para impedir dobles envíos. No se reescribió AcademicController ni se modificaron BFF, backend, contratos, tokens de diseño, globals.css, cifrado, esquema de IndexedDB, retención o política de recuperación.

## Identidad, sesiones y límites de seguridad

Las pruebas reales usan únicamente cuentas USER sintéticas propias. Recorren registro/login, renovación HttpOnly, desafío y enrolamiento MFA, códigos offline de un uso, regeneración, desactivación, revocación de sesiones, CSRF y denegación administrativa. No se elevó ninguna identidad existente ni se debilitó MFA.

Las acciones MFA conservan la reautenticación y revocación del servidor. Su confirmación solo guarda qué operación se solicita; las credenciales permanecen en el formulario y se leen al confirmar. Cancelar no transmite las credenciales. Los errores conservan los valores para corregirlos.

Cerrar otras sesiones conserva el acceso actual. Cerrar todas es una salida explícita: reutiliza `AcademicProvider.clear()`, elimina las copias de la cuenta y comunica el cierre según la política H6-3. La prueba comprueba una copia cifrada antes de cancelar, su conservación tras cancelar y cero copias tras confirmar el cierre. Una revocación o cambio sensible de MFA conserva la política existente de sesión expirada, con recuperación solo al reautenticar la misma cuenta.

El DTO actual de sesiones no indica cuál es la actual. La interfaz comunica esa ausencia y no la deduce de fechas u orden. El badge solo aparece cuando termina una consulta satisfactoria; nunca presenta un cero inicial como dato recibido.

ADMIN/SUPERADMIN se ejercitan con Next de producción, Chromium y un upstream HTTP local grabador. Comprueban estructura, peticiones, versiones, cancelación y errores. Ese upstream no es Spring ni prueba autorizaciones privilegiadas reales. La única autorización administrativa contrastada con Spring en este encargo es la denegación USER. D02–D05 mantienen expresamente pendiente la verificación con roles reales autorizados.

Las evidencias MFA se escriben ocultando QR, semillas, contraseñas y códigos antes de crear el PNG. Los registros de pruebas no guardan cuerpos de autenticación ni tokens. Las capturas documentales publicadas usan un PDF sintético; el original C2PA autorizado solo se usa en la regresión privada y no se añade al repositorio.

## Regresiones y pruebas

La imagen final aprueba TypeScript, 45 unitarias/componentes y build Next.js. El build local también aprueba. Se ejecutan cuatro integraciones BFF H3 y seis integraciones OIDC con upstream controlado. Cinco pruebas de navegador controladas recorren administración, errores y confirmaciones. El cierre completo Playwright aprueba 79 casos, con tres omisiones por duplicación y cero fallos; se registra en `pruebas.json`; los errores iniciales de fixtures/selectores se corrigieron antes del cierre.

ST-01–ST-10 vuelven a comprobar bancos por fuente, revisión, Quiz, Crucigrama, cambios de herramienta/tema/tamaño, retorno a materia, cuenta A/B, expiración, concurrencia de pestañas, recuperación cifrada y descarte. Spring guarda un envío cuya respuesta se pierde; tras recarga, el reintento conserva exactamente cuerpo, duración y clave. No se hace POST al montar ni se sustituye un envío pendiente por otro intento.

Las regresiones documentales verifican carga, cuarentena, procesamiento, READY, FAILED, OCR, descarga original y lectura sin iframe/object/embed. El original C2PA mantiene su SHA-256 `66cdd9f6cd895d4837cd68aa1208d89ca4bf4b9760e2c24e54cbf9e76815735e` y sus trece páginas. El catálogo sigue sin `createdAt` y no muestra una fecha ficticia.

## Reproducir las comprobaciones

Desde `frontend/` de esta rama, con Node 24 y las dependencias exactas del lockfile:

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:integration:activities
npm.cmd run test:integration:identity
npm.cmd run test:integration:nexo
$env:E2E_BASE_URL='http://127.0.0.1:3107'
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:NEXO_EVIDENCE_DIR='../.cache/h6-4-nexo'
$env:ACADEMIC_EVIDENCE_DIR='../.cache/h6-4-academic'
npm.cmd run test:e2e
```

La suite documental requiere `academic.pdf`, `scanned.pdf` y `blank.pdf` en `.cache/phase2-fixtures/` del worktree. En esta ejecución se reutilizaron las fixtures sintéticas autorizadas H6-3. `SIARE_TEST_PDF` apuntó además al original autorizado `.cache/pdf-diagnosis/original.pdf` del checkout principal; sin esa variable, no se acredita la regresión C2PA adicional. No hay script lint y no se inventa una comprobación de ese nombre.

## Revisión visual y accesibilidad

Rutas y estados controlados se miden en claro/oscuro en 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 390×844, 375×812 y 320×812. El test académico se amplió de cinco a ocho tamaños en ambos contextos Chromium. Se capturan además carga de materia/documento, cuarentena, procesamiento solicitado, envío pendiente, catálogo, consulta y materia archivada. Las esperas retenidas por Playwright se identifican como transporte controlado, sin inventar progreso ni un lease del servidor.

Se inspeccionaron imágenes reales de Inicio, portada móvil, administración oscura y seguridad móvil frente al Nexo original. Esa revisión corrigió la tarjeta de identidad móvil: nombre/correo conservan una columna legible y la acción pasa a otra fila.

Se comprueban etiquetas, errores asociados, foco, Escape, Cancelar, restauración de foco, navegación por teclado y continuidad de formularios. El diálogo usa showModal y la contención nativa de foco; el navegador permite acceder a su propia barra. El contraste medido incluye los pasteles nuevos, tinta naranja, superficies compuestas, errores y controles. No se ocultó overflow de la página para superar geometría.

El intento de zoom mediante cuatro aceleradores Control+= no cambió innerWidth ni devicePixelRatio en Chromium headless; no acredita zoom real 200 %. El escalado de fuente 200 % del test académico es una comprobación distinta. Firefox/WebKit, lector de pantalla, teclado virtual y dispositivos físicos siguen pendientes. Los skeletons se capturaron transitoriamente en 1440: falta su evidencia en los otros siete tamaños. La matriz no presenta estas limitaciones como aprobadas.

## Docker, preservación y reversión

Proyecto de preview existente: `siare-h6-3-validation`, servicio `frontend-h6`, contenedor `80207a58551610ac29a2540020a0cb6539dfd11af17e3fa579cb85475f3ef78c`, puerto loopback 3107. Imagen activa `siare-academico-frontend:h6-4-isolated`, ID `sha256:515ff308e35238bdb146dd3dcaa645b7a650efdd2dde9c05f7dff36b7d8067e4`, revisión OCI `cc6cd704a4f93227123afc796f3682315aba862f`. Estado healthy y `/api/health` UP.

Se conservaron configuración y límites de `.cache/h6-3/preview.compose.json`; `.cache/h6-4/preview.override.json` cambia solo imagen y etiquetas de ese servicio. Se aplicaron Common.ps1, propiedad/volúmenes y controles Compose antes de recrear. El comando fue:

```powershell
docker compose --project-name siare-h6-3-validation --file .cache/h6-3/preview.compose.json --file .cache/h6-4/preview.override.json up --detach --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 180 frontend-h6
```

La imagen H6-3 activa previa quedó en `siare-academico-frontend:h6-3-before-h6-4`, ID `sha256:5e0f6c0df4ccfaa0f829d2a1c2a2a6b9082a9aae0c32fdb5e49da49ee4b3b790`. Para revertir, usar la misma configuración base sin el override H6-4 y el mismo `up` selectivo, con espera healthy. La etiqueta `h6-3-isolated` original no se reemplazó. No se necesita limpiar ni eliminar datos.

`Test-Siare.ps1` aprueba salud, propiedad, consultas autenticadas y frontend habitual. La comparación antes/después confirma nueve IDs de contenedor e imágenes idénticos y healthy. El humo de navegador de portada/login en 3100 responde 200. No se reconstruyó 3100 ni se recrearon otros servicios; no se modificaron redes, volúmenes, .env, claves o credenciales, ni se desplegó Flyway V6 o generación ML. Los cambios ajenos del checkout principal y las capturas históricas H6-3 se conservan.

## Pendientes concretos

H6-5: revisar interacciones finales con teclado/lector y dispositivos físicos, incluidos foco durante errores sensibles, menús y teclado virtual. Las confirmaciones ya son nativas y compartidas; no hay justificación para añadir SweetAlert2 o una librería de animación.

H6-6: validar ADMIN/SUPERADMIN con identidades autorizadas y MFA en un entorno de prueba; comprobar Google/GitLab real y SMTP/reset exitoso; revisar Firefox/WebKit, zoom real 200 %, lector y contraste de píxeles; capturar cargas transitorias en los siete tamaños restantes y un lease PROCESSING expirado sin alterar trabajos reales. Mantener las 50 filas abiertas a esta auditoría hasta resolver sus omisiones concretas.

## Skills y referencias

Se consultaron UI/UX Pro Max (`error summary validation` y stack Next.js), Modern Web Guidance y DakaDesing con su [adaptación SIARE](H6_SKILLS_SIARE.md). La identidad elegida era Nexo; no se volvió a solicitar referencia ni se adoptó una paleta genérica. Se revisó el método de [claude-webkit](https://github.com/Hainrixz/claude-webkit/blob/main/.claude/skills/frontend-design/SKILL.md) para jerarquía y revisión visual.

Modern Web Guidance:

- `forms`: conservé restricciones nativas y el envío, con errores relacionados y foco en el resumen: “move focus to the first invalid field”. Los estados pending bloquean el doble envío después de un envío válido.
- `accessibility`: usé etiquetas visibles, listas semánticas y contención modal nativa: “Don't implement focus traps for native modal dialogs”.
- `dialog`: las confirmaciones enfocan Cancelar y mantienen el guard de cancelación durante pending. Añadí contención progresiva del scroll al diálogo/backdrop sin bloquear html/body: “scrolling over the backdrop”.
