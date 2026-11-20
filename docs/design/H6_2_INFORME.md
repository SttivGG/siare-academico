# H6-2: implementación global de los fundamentos Nexo

Entrega del 19 de noviembre de 2026, America/Bogota. **Base global implementada; despliegue habitual bloqueado por H6-3.** La alternativa A está preparada como composición controlada; la integración académica central y la recuperación durable no se declaran completadas.

## Rama y revisión

Rama `feat/h6-2-nexo-global`, derivada del worktree H6 en `c8f9344`. El commit `f5152de` conserva íntegramente los entregables H6-0/H6-1 y el inventario que estaban sin versionar. La implementación y los ajustes visuales están en `79aa067`, `2203fb7` y **`1931ddbcf177fbfe3ffbb4b8041a4335fd601edb`**, revisión de código de la imagen final. Los commits posteriores de evidencia no cambian ese runtime.

El delta se limita a frontend, pruebas y `docs/design/`. No incorpora H5 ni Flyway V6. Las cinco rutas técnicas, Spring, Python, Express, configuración Compose habitual y lockfile de dependencias conservan su contenido. Los PR #8 (`feat/h5-b-generation-port`, ca27a80) y #9 (`feature/h5-d-persistencia-borradores`, ff104c2) permanecen abiertos e independientes. No se fusionó ningún PR ni se modificó main.

## Componentes y rutas

| Entrega | Implementación y alcance |
| --- | --- |
| Tokens globales | `frontend/src/styles/tokens.css`: colores semánticos claros/oscuros, Urbanist local y licencia existente, naranja original con tinta oscura, pasteles, opacidades, foco, radios, sombras, tamaños y ritmos H6-1. Compatibilidad de `light-dark()` y fallback sólido sin blur. |
| Tema | `ThemeControl`, enum validado, bootstrap antes de pintar, `color-scheme`, preferencia Sistema, sincronización entre pestañas y aviso si almacenamiento está bloqueado. Sin identidad ni datos académicos almacenados. |
| Primitivas | Button, IconButton, ProviderButton, Field, Select, Surface, Notice, StatusBadge, EmptyState, LoadingState y Progress. AuthForm utiliza los campos/botones reales; Google/GitLab comparten ProviderButton. No se duplicaron formularios ni peticiones. |
| Overlays | Dialog nativo aplicado al archivo de materia. Foco, Escape, cancelación y pending; acciones solo tras confirmación. Menús de navegación/cuenta/tema con un solo desplegable abierto. No se instaló SweetAlert2: no aportaba una ventaja a esta confirmación. |
| Público y acceso | PublicShell en `/`; AuthShell en `/login`, `/registro`, `/recuperar`, `/recuperar/confirmar`, `/login/mfa` y `/sesion/renovar`. Conservan mensajes, OIDC, MFA, recuperación y renovación existentes. |
| Aplicación | AppShell, rail SVG, encabezado flotante, ruta contextual, menú de cuenta con nombre/correo reales, tema y navegación móvil en `/inicio`, `/materias`, `/materias/nueva`, `/materias/[id]`, `/seguridad`, `/sesiones` y `/administracion`. Identidad/autorización siguen comprobándose en servidor. |
| Workspace A | WorkspaceShell envuelve una única instancia de SubjectWorkspace. WorkspaceColumns prepara los slots 256/centro/240, tableta con lateral alternable y móvil con navegación inferior; **todavía no sustituye el layout académico heredado**. H6-3 debe conectar los slots al controlador estable. |
| Fronteras | FeedbackShell para 404/error y LoadingState para sesiones/administración. Tema y navegación no anticipan controles privilegiados. |

Las 14 páginas tienen identidad base Nexo. Eso no equivale a cerrar sus estados internos. La [matriz actualizada](H6_MATRIZ_ACEPTACION.csv) mantiene **50 filas: 14 rutas y 36 casos**, con propietarios reales, captura, prueba y etapa pendiente. [cobertura.json](evidencias/h6-2/cobertura.json) coteja el árbol y separa las cinco rutas técnicas.

## Capturas y comparación visual

La [galería de evidencias](evidencias/h6-2/README.md) enlaza las 14 páginas y 404 en claro/oscuro, escritorio 1440×900, tableta 768×1024 y móvil 390×844. Los controles de geometría también abarcan 1920×1080, 1366×768, 1024×768, 375×812 y 320×812. Son viewports CSS; algunas imágenes de página completa son más altas que el viewport indicado.

Se añadieron diálogo en ambos temas, cuenta, OIDC controlado, texto documental, evaluación de Spring, colores forzados, tema sin JavaScript y una captura separada del runtime habitual. Las cuentas/materiales son sintéticos. No se publican contraseñas, cookies, QR/semillas MFA, códigos offline ni tokens de recuperación.

La revisión visual contrastó Nexo original y el prototipo A: conserva Urbanist, naranja/pasteles, fondo cálido, rail de 84 px, encabezado de 64 px y superficies translúcidas. Se retiraron las variables claras exclusivas del workspace y los colores verdes heredados. Formularios/opciones usan una base más opaca. Autenticación tiene composición propia coherente con esos tokens. **El centro académico sigue siendo una diferencia pendiente frente a A**: no se atribuye a H6-2 la tarea central de H6-3 ni la navegación inferior integrada. No se usó una puntuación de similitud entre pantallas de contenido diferente.

## Pruebas y límites

| Verificación | Resultado |
| --- | --- |
| TypeScript | `npm.cmd run typecheck`: aprobado; también dentro de la imagen final. |
| Build | `npm.cmd run build`: aprobado localmente y en Docker con Next.js 16.4.6 y dependencias fijadas. Imagen final usa Node 24.22.2. |
| Unitarias/componentes | `npm.cmd test`: **35 aprobadas**, incluidas TSX reales, accesibilidad de campos, pending, avisos, progreso y bootstrap de tema con almacenamiento denegado. |
| BFF de actividades | `npm.cmd run test:integration:activities`: **4 aprobadas**, cinco operaciones, CSRF, renovación HttpOnly, límites y reintento con cuerpo idéntico; upstream controlado identificado. |
| Playwright | Suite sobre Docker aislado en 3107: **28 aprobadas, 4 omitidas, 0 fallos y 0 flaky**. Chromium 153.0.8010.12, proyectos escritorio/móvil. [Resultados por prueba](evidencias/h6-2/pruebas.json). |
| Matriz visual | 14 rutas más 404, ambos temas, ocho anchos/altos: **240 comprobaciones de geometría** sin overflow horizontal, Urbanist y una sola región main. [Mediciones](evidencias/h6-2/validacion.json). |
| Accesibilidad dirigida | **72 pares/compuestos de tokens** alcanzan 4,5:1 para texto y 3:1 para foco/control; teclado, skip link, Escape/foco, forced colors y reduced motion aprobados. [Contraste](evidencias/h6-2/contraste.json). No acredita una auditoría WCAG completa. |
| Continuidad de presentación | Banco abierto conserva JSON/tema al alternar claro/oscuro, anchos y diálogo. Cancelar/Escape no envían archivo. Menú de cuenta conserva formulario. Sin errores JS ni avisos de hidratación en las rutas capturadas. |
| Instalación habitual | `scripts/Test-Siare.ps1`: aprobado, nueve healthy, propiedad/volúmenes, cinco motores, tres backends, puertos y frontend→Spring. Navegador en 3100 confirma que sigue H4. |

Las cuatro omisiones están identificadas: ST-01 Banco/Catálogo/Banco marcado fixme en escritorio/móvil porque el fallo sigue presente; matriz y contraste se omiten en el proyecto móvil porque la matriz interna ya incluye los ocho tamaños. Ninguna omisión se cuenta como aprobación.

Las suites reales cubren registro/login, edición/archivo, filtros, documentos READY/lectura/descarga, bancos revisados, Quiz, Crucigrama, evaluación, paginación, propiedad, sesiones, MFA USER y denegación administrativa. OIDC de interfaz y callbacks usa respuestas controladas; no certifica login externo Google/GitLab ni entrega SMTP real. ADMIN/SUPERADMIN, lector de pantalla, Firefox/WebKit, zoom real 200 % y teclado virtual físico siguen pendientes de etapas posteriores.

La suite documental necesitó la fixture oficial `.cache/phase2-fixtures/academic.pdf`, ya generada en el checkout habitual; se copió al worktree y se verificó su hash `51a3da9d83a2581b655579bba4e16ab877438f3ce2067b9ecc5b3262c9202c1e`. No se rebajó validación documental ni se cambió backend para hacer pasar la prueba.

## Docker, datos y condición de despliegue

El proyecto habitual sigue siendo `siare-academico`, con `compose.datos.yml`, `compose.apps.yml` y `.local/deployment-h4-20261119/frontend-source.json`. Frontend habitual: contenedor **eae9ae80e3c1**, imagen **sha256:c67d08bd4d4ef8e405f1d886ed3fec4c9fdb62f06be117184a8ff68c7c9ff5b0**, puerto **3100**. Se preservó con etiqueta adicional `siare-academico-frontend:pre-h6-2-20261119`. Los otros ocho contenedores/imágenes conservan sus IDs.

La revisión H6 se construyó únicamente como `siare-academico-frontend:h6-2-isolated`, imagen **sha256:3954bd77f2eb979fe493da65cf57139dc8cea7871c4a0c9397fe0f581cb314a7**, etiqueta OCI de revisión **1931ddbcf177fbfe3ffbb4b8041a4335fd601edb**. Se ejecuta healthy en el proyecto separado `siare-h6-2-validation`, servicio `frontend-h6`, puerto **127.0.0.1:3107**, sin volúmenes. Usa la red edge existente y Spring real; conserva los límites oficiales de frontend (384 MiB, 1 CPU) y su healthcheck. Su configuración local está en `.cache/h6-2-isolated.compose.json`.

No se recrearon servicios habituales, redes, volúmenes, claves ni credenciales. Las pruebas añadieron cuentas, materias, documentos e intentos **sintéticos**, sin eliminar o cambiar datos existentes ni elevar roles. El [registro de runtime](evidencias/h6-2/runtime.json) conserva IDs completos, imágenes, salud y nombres de volúmenes, sin variables secretas.

**No se desplegó H6 en 3100.** La prohibición expresa del encargo aplica mientras persistan los bloqueantes funcionales. El contenedor aislado acredita ejecución y validación de esta fase; no se presenta como despliegue habitual ni como aprobación H6-7.

## Entrega a H6-3

Los [propietarios, garantías y tareas concretas](H6_2_ESTADO_Y_H6_3.md) incluyen: controlador estable por usuario/materia/fuente/actividad; preservación de borrador/revisión/respuestas/celdas/tiempos/sobre; integración central A sin duplicar jugadores; eliminación de `createdAt` inexistente; recuperación cifrada con custodia de clave independiente, consentimiento, retención y aislamiento; pruebas ST-01–ST-10. Hasta resolverlo, se conserva el bloqueo de despliegue habitual.

### Modern Web Guidance

- **`dark-mode`**: apliqué “Apply page-wide color scheme to CSS :root or html” para que canvas y controles nativos acompañen el tema. Los tokens tienen fallback para motores sin `light-dark()`.
- **`dark-mode-toggle`**: mantuve Sistema y arranque previo al pintado; “handle window's storage event” fundamenta la sincronización entre pestañas. Si el almacenamiento falla, el tema sigue operativo durante la visita.
- **`css`**: seguí “Use CSS custom properties on :root” y evité nuevos resets globales. Los shells/diálogo usan módulos; los módulos heredados conservan clases explícitas con aliases semánticos hasta su migración H6-4.
- **`accessibility`**: usé “Use the native <dialog> element” para foco e inercia, con cancelación sin mutación. Las pruebas comprueban foco/restauración y etiquetas/errores asociados.

Se consultaron UI/UX Pro Max, DakaDesing y su adaptación SIARE; ninguna propuesta genérica sustituyó la identidad aprobada. La conservación de React se contrastó con su [documentación oficial](https://react.dev/learn/preserving-and-resetting-state), y el método visual con [claude-webkit](https://github.com/Hainrixz/claude-webkit/blob/main/.claude/skills/frontend-design/SKILL.md). Las recomendaciones externas no cambian contratos ni autorizan despliegues o fusiones.
