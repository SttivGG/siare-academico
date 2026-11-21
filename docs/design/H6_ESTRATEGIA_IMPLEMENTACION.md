# H6: estrategia de implementación integral Nexo

Fecha: 19 de noviembre de 2026, America/Bogota. Estado: propuesta concreta para la revisión de cobertura previa solicitada por el usuario. El [inventario global](H6_COBERTURA_GLOBAL.md) contiene 14 rutas, 5 manejadores técnicos y 36 casos internos/transversales.

La identidad oficial es Nexo y la alternativa aprobada del workspace es A, Cuaderno abierto. Se conservan las referencias H6-0/H6-1 y sus evidencias sin reescribir su historia. La última solicitud amplía la cobertura a toda la web y exige recuperación segura tras recarga; esas dos condiciones prevalecen sobre los textos históricos que todavía las tratan como decisiones pendientes.

## Base de implementación y límites

Trabajar sobre la base H6 `c8f934492f0cc7809282657270df34b4474915ca`, cuyo frontend/servicios coincide con la revisión desplegada `697621ee8a6a450c551bbf6f13ffda6fc2beab18`. El worktree existente es `.worktrees/h6`, rama `feat/h6-design-audit`. Su documentación previa está sin confirmar y se preserva. No se sustituirá por el frontend anterior del checkout habitual.

El delta productivo previsto queda en `frontend/`, sus pruebas y `docs/design/`. Se conservan Spring, Flask, Express, bases de datos, contratos y políticas BFF. La gestión estética no modifica autorización, revisión humana de bancos, evaluación, límites documentales ni renovación/idempotencia. No se incorpora Flyway V6, no se modifican los PR #8/#9 y no se crean métricas ML, historial general o generación multidocumento.

## H6-2: fundamentos y navegación

Extraer los tokens semánticos de [H6-1](H6_1_SISTEMA_DISENO.md) a una única fuente del frontend. Compartir superficie, texto, borde/control, foco, acción, selección, éxito, información, advertencia y error en ambos temas. Reutilizar neutrales/pasteles Nexo, naranja `#F58136`, Urbanist local y licencia. La tinta sobre naranja seguirá siendo oscura; enlaces y foco tienen tokens propios.

Crear primitivas tipadas en `components/ui/` y composiciones en `components/layout/`, según las convenciones reales del proyecto. `Button`, `IconButton`, `Field`, `Select`, `Notice`, `StatusBadge`, `Surface`, `EmptyState`, `LoadingState`, `Progress` y la capa de overlays comparten estilos y comportamiento. Los módulos de negocio mantienen sus peticiones y responsabilidades; no se duplican formularios para conseguir otra apariencia.

Construir `PublicShell`, `AuthShell`, `AppShell` y la base de `WorkspaceShell`. La portada y autenticación no tendrán tres paneles. El rail de escritorio, breadcrumbs, menú de cuenta y navegación móvil parten de las rutas existentes y del rol confirmado por servidor. La navegación inferior Fuentes/Aprendizaje/Estudio pertenece solo al workspace A; el menú global móvil no debe superponerse con ella.

El control de tema ofrecerá claro, oscuro y sistema en páginas públicas y privadas. La preferencia visual puede persistirse como enum sin identidad ni datos académicos. Resolver tema inicial, `color-scheme` y sincronización con el sistema sin flash ni errores de hidratación. Una falla de almacenamiento conserva el funcionamiento del selector durante la página.

Revisar el catálogo base y los shells en ambos temas, con teclado y tamaños móvil/tableta/escritorio. Mantener comprobaciones servidor como Server Components; limitar clientes a las partes interactivas. La revisión visual de esta etapa se conserva antes de migrar los grupos completos.

## H6-3: workspace A y recuperación del trabajo

En escritorio amplio: Fuentes de referencia 256 px, centro flexible dominante, Estudio 240 px y separaciones de 16 px. Son medidas del prototipo aprobado, sujetas a validar contenido real sin cambiar la alternativa. A 701–1199 px, centro con un lateral visible y conmutación de Fuentes/Estudio. Hasta 700 px, un panel por vez y navegación inferior con nombres. Plegar laterales cuando falte espacio y reservar área para barra, teclado y safe area.

Fuentes contiene carga bajo demanda, búsqueda sobre la lista disponible, estados reales, selección única, procesamiento/reintento y descarga autorizada. Lectura, banco, catálogo, Quiz, Crucigrama, envío, resultado y consulta de intento abren su contenido principal en el centro. Estudio ofrece accesos reales a esas herramientas. Configuración de materia aparece bajo demanda y no desplaza permanentemente la tarea.

Separar estado académico y presentación. Un controlador estable por usuario/materia conserva banco por fuente, revisión/huella, actividad, respuestas/celdas, índice/dirección, inicio, duración y envío congelado. No usar claves basadas en tema, panel o breakpoint, ni montar jugadores independientes para móvil/escritorio. Una respuesta tardía se aplica a su actividad y nunca al trabajo de otra materia.

Corregir el resumen del catálogo al contrato real: no tiene `createdAt`. Omitir la fecha ausente; validar y formatear solo fechas presentes del contrato correspondiente. La selección de una fuente diferente invalida la revisión pertinente sin borrar el borrador previo ni cambiar la procedencia de una actividad ya creada.

### Política propuesta para recarga

Esta política se presenta para revisión antes de implementar la persistencia. Protege la recuperación de trabajo propio dentro de este navegador; no implica sincronización entre equipos ni persistencia H5.

| Aspecto | Propuesta y criterio de aceptación |
| --- | --- |
| Cambio de panel/tema/tamaño | Conservación automática en el controlador, sin pedir contraseña local ni depender del almacenamiento. |
| Recuperación tras recarga | Opción explícita de conservar una copia cifrada en este dispositivo, ofrecida al iniciar trabajo editable. Explicar alcance y caducidad; no anunciar guardado antes de confirmar una escritura. |
| Material recuperable | Texto/configuración del banco creado por el usuario, respuestas/celdas, índice/dirección, selección, inicio y sobre de envío pendiente. Esquema con lista permitida de campos y versión; no serializar objetos API completos. |
| Exclusiones | Nunca persistir JWT, refresh, cookies, contraseña SIARE, desafíos/códigos/semillas MFA, tokens OIDC/reset, originales documentales, snapshots privados ni respuestas esperadas/feedback de evaluaciones. El banco manual contiene soluciones del autor: su contenido también debe cifrarse, nunca guardarse en claro. |
| Almacenamiento | IndexedDB con cifrado autenticado mediante Web Crypto. Propuesta: AES-GCM, IV nuevo por escritura y clave derivada con PBKDF2 de una frase local independiente, con sal aleatoria. Los parámetros y límites se concretarán y probarán antes de implementar, sin criptografía propia. |
| Clave y desbloqueo | La frase local se introduce para habilitar y recuperar la copia; no se reutiliza la contraseña SIARE. No persistir frase ni clave ni entregarlas al servidor. Tras recarga se requiere sesión válida y desbloqueo local; no se puede prometer restauración transparente sin custodiar una clave. |
| Aislamiento | Vincular versión, usuario, materia, fuente y actividad al registro y a sus datos autenticados. Verificar identidad/propiedad actuales con servidor antes de restaurar; invalidar revisión al cambiar fuente/contrato. Prueba con cuentas A y B obligatoria. |
| Retención | Propuesta: siete días como máximo desde la última edición, eliminación en descarte explícito y tras éxito confirmado del elemento correspondiente. Cierre de sesión elimina copias de esa cuenta y referencias a claves; sesión expirada bloquea acceso y permite recuperar al reautenticar como la misma cuenta dentro del plazo. La purga del navegador solo puede ejecutarse cuando la aplicación vuelve a correr; no prometer borrado físico al cumplirse el plazo con la aplicación cerrada. |
| Envío pendiente | Escribir y confirmar el sobre cifrado antes de comunicar que es recuperable. Reintentar solo por acción explícita, con el mismo cuerpo, duración y clave de idempotencia; nunca reenviar al montar una vista o cambiar tema. |
| Fallos | Cuota, almacenamiento bloqueado, copia corrupta, frase incorrecta o API criptográfica no disponible producen un aviso persistente. Conservar trabajo en memoria y ofrecer recuperación local cifrada cuando sea posible; impedir salida silenciosa y permitir cancelarla. No etiquetar como recuperable un dato que no se escribió. |
| Usuario que no habilita copia | La aplicación conserva el trabajo durante cambios internos y explica que recarga/cierre no son recuperables. Este modo no acredita la regresión de recuperación durable: H6 debe verificar por separado el modo cifrado habilitado. |

La elección de frase local implica una interacción nueva y debe revisarse con la cobertura. Si se exige recuperación sin frase después de recargar, habrá que acordar otra custodia de claves antes de implementarla. No se resolverá guardando la clave junto al contenido ni usando tokens de sesión como claves.

Web Crypto no protege frente a código malicioso que ya ejecuta en el mismo origen. El cifrado local limita exposición del contenido almacenado; no sustituye autorización, controles contra inyección o higiene de dependencias. Esta limitación está descrita en las [consideraciones de seguridad de W3C Web Cryptography](https://www.w3.org/TR/webcrypto/#security-considerations).

Las pruebas bloqueantes ejercitarán el recorrido real que pierde trabajo: Banco/Catálogo/Lectura, Quiz/Fuentes/Estudio, Crucigrama y redimensionado; recarga con banco y respuestas; envío guardado por Spring con respuesta perdida; doble clic; frase incorrecta; almacenamiento fallido; cuenta A/B; cierre y expiración. Se conserva el sobre incluso cuando el servidor respondió tarde. No basta con probar el prototipo o funciones de copia de arrays.

## H6-4: grupos completos de pantallas

| Grupo | Alcance | Revisión requerida |
| --- | --- | --- |
| Público y acceso | R01–R07 y A01–A05; portada, login, registro, recuperación, MFA, renovación y Google/GitLab | Composición de autenticación completa, validaciones, mensajes y todos los estados. No dibujar páginas externas del proveedor como si fueran SIARE. |
| Aplicación principal | R08–R10; dashboard, materias, filtros y creación | Identidad Nexo, datos reales, vacío/carga/error y continuidad de navegación. |
| Identidad | R12–R13 e I01–I06; resumen de perfil, seguridad, sesiones, identidades y tema | Datos ya disponibles, sesión reciente/MFA, cancelación y revocación reales. Sin añadir edición de perfil ni nueva API de preferencias. |
| Administración | R14 y D01–D05; denegación, ADMIN, SUPERADMIN, ámbitos, parámetro y auditoría | Evidencia por rol y ámbito. Conservar versión, reglas de asignación, límites y servidor como autoridad. |
| Transversal | X01–X06; 404, error, skeletons, shell y primitivas | Ningún componente ni estado mantiene la identidad anterior. |

Migrar cada grupo con las mismas primitivas y retirar sus reglas antiguas cuando no tengan consumidores. Revisar `globals.css` para eliminar el alcance exclusivo `.nexo-workspace` y overrides contradictorios; no resolver la cobertura con un override visual gigante sobre componentes incompatibles. Mantener etiquetas, navegación, foco, pending y permisos en los módulos existentes.

## H6-5: interacciones y acabados

Usar CSS y los ritmos H6-1 de 140/220 ms para cambios que comuniquen estado. Respetar movimiento reducido; evitar shimmer y transiciones decorativas que retrasen tareas. No hay justificación actual para incorporar una biblioteca pesada de animación.

Centralizar overlays y confirmaciones. Evaluar SweetAlert2 solo si mejora una interacción concreta frente al diálogo nativo Nexo y documentar la decisión; verificar entonces su API oficial. Nunca sustituir globalmente `window.alert/confirm/prompt`, ni convertir una revisión académica en un aviso breve. La búsqueda actual no encontró llamadas nativas: `async function confirm` de MFA es un manejador local.

Confirmaciones que revisar: archivo de materia, desconexión de identidad, cierre de sesiones, cambios administrativos y salida con trabajo pendiente. Cancelar no envía peticiones. Éxitos después de respuesta real; errores recuperables conservan valores y acciones. Formularios complejos permanecen en su contexto. `beforeunload` conserva su función limitada y no acredita persistencia.

## H6-6: auditoría y condición de salida

Completar todas las filas de la matriz con capturas claras/oscuras y evidencia responsive/funcional; identificar la revisión exacta capturada. Las 14 rutas y 36 casos se verifican contra el árbol real de App Router antes de cerrar: una ruta añadida durante la migración debe incorporarse al inventario.

Ejecutar, desde el frontend H6, los comandos existentes pertinentes: `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run test:integration:activities` y `npm.cmd run test:e2e`. No existe script `lint`. Las suites actuales cubren `phase-one`, `phase-two`, `activities`, `identity`, `mfa` y `oidc`; se añadirán regresiones de pérdida de estado y recuperación porque esos recorridos tienen fallos comprobados.

Playwright actual solo define Chromium de escritorio y móvil, no toda la matriz. Ampliar cobertura a las ocho resoluciones del inventario; incluir WebKit/Firefox donde estén disponibles y registrar cualquier límite. Probar zoom real 200 %, teclado, foco, contraste compuesto, forced colors y movimiento reducido. Verificar interacción de barra inferior con teclado virtual y safe area; una captura de escritorio estrecha no acredita un teléfono físico.

Los recorridos de registro/login, MFA, materias, documentos, bancos, Quiz, Crucigramas, resultados y administración deben funcionar con servicios reales o proveedores controlados identificados. No elevar ni cambiar roles de cuentas existentes para obtener una captura. Diferenciar prueba controlada de OIDC/correo de integración externa real.

Cada etapa conserva una revisión visual con capturas y regresiones antes de avanzar. La revisión previa de cobertura es el punto de entrega actual. La auditoría final debe aprobar cobertura y regresiones antes del despliegue H6-7; una página pendiente o pérdida silenciosa bloquea esa salida.

## H6-7: despliegue selectivo de frontend

Al llegar a H6-7, repetir identificación de proyecto, archivos Compose, imagen por digest, revisión y contenedores realmente activos. Aplicar `scripts/Common.ps1` y controles oficiales de identidad, propiedad, Compose y recursos; no imprimir configuración expandida con secretos. No arrancar el `compose.yaml` de guarda.

La instalación actual usa `compose.datos.yml`, `compose.apps.yml` y el override `.local/deployment-h4-20261119/frontend-source.json`. Ese override apunta a una copia congelada de H4. Preparar una fuente congelada H6 identificable y un override privado acotado a frontend, conservar las opciones oficiales del servicio y comprobar que el contexto contiene la revisión aprobada. No reconstruir a ciegas desde el checkout antiguo ni desde la copia H4.

Antes de reemplazar la etiqueta activa, conservar **la imagen funcional actual** con una etiqueta de reversión propia de H6 y registrar su ID completo. La antigua `pre-h4` no reemplaza este respaldo del runtime actual. Construir exclusivamente frontend y recrearlo con el equivalente oficial de `up --detach --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 180 frontend`, usando los archivos/proyecto e identidad verificados.

Si falla la recreación o las comprobaciones, restaurar etiqueta/override e imagen anterior y recrear solo frontend; volver a esperar salud. No ejecutar migraciones, reinicios de datos, limpieza global ni eliminación de volúmenes/redes.

Verificar nueve servicios healthy, frontend `/api/health` UP y recorridos de navegador en `http://127.0.0.1:3100`. Ejecutar `Test-Siare.ps1` con los controles oficiales y repetir humo de las funciones cambiadas sobre el contenedor efectivo. Comparar IDs de los otros ocho contenedores e imágenes con la captura anterior. Registrar rama, commit o manifiesto exacto del árbol si hay cambios sin confirmar, imagen construida/activa/de reversión, IDs y pruebas. Un build exitoso o una imagen de prueba no acreditan despliegue.

## Skills y referencias consultadas en esta revisión

Se leyeron `modern-web-guidance`, `ui-ux-pro-max`, `dakadesing` y la adaptación [SIARE](H6_SKILLS_SIARE.md). Se usó `deslop` para redactar. No se modificaron skills globales ni se instalaron dependencias de runtime.

Modern Web Guidance se buscó con `responsive workspace panels`; se recuperaron y leyeron completas `responsive-design` y `css-layout`. Orientan la propuesta de alto dinámico, tamaño intrínseco, scroll acotado, orden DOM y tipografía con límites relativos. No se implementó código en esta entrega. Se conservó la versión local `2026_11_09-5bcc021b` pese al aviso de actualización.

UI/UX Pro Max se consultó para sistema global y stack Next.js. La propuesta automática devolvió landing, Inter y una paleta azul/rosa ajenas a Nexo; se descartó como dirección visual y no se persistió. La consulta de stack respalda fronteras servidor/cliente, con metadatos 16.2 frente a Next.js 16.4.6 real. Las APIs concretas se verificarán al implementarlas.

Se leyó [frontend-design de claude-webkit](https://github.com/Hainrixz/claude-webkit/blob/main/.claude/skills/frontend-design/SKILL.md) para jerarquía y revisión. Sus preferencias generales no cambian Urbanist/Nexo ni autorizan éxito optimista para evaluaciones o acciones administrativas. SweetAlert2 sigue en evaluación; no se ha instalado.

## Verificación de la instalación al preparar el inventario

Consultas de solo lectura sobre proyecto `siare-academico`: nueve contenedores healthy; `/api/health` respondió HTTP 200 con `{"service":"frontend","status":"UP"}`. Los archivos Compose activos coinciden con los tres indicados anteriormente. El frontend tiene etiqueta de revisión `697621ee8a6a450c551bbf6f13ffda6fc2beab18`.

| Servicio | ID corto de contenedor | Imagen realmente activa, SHA-256 | Salud |
| --- | --- | --- | --- |
| frontend | `eae9ae80e3c1` | `c67d08bd4d4ef8e405f1d886ed3fec4c9fdb62f06be117184a8ff68c7c9ff5b0` | healthy |
| core-api | `27138d454210` | `ecff70dea3a1061462ec103d81fed5f6729a2b8cee1113670afc87f814642e84` | healthy |
| content-ai | `8a7f97dc46a9` | `212a8df4b6896d98ad607d66db4c7f03d562fa871dffa8f8e9bae93d17f36ba4` | healthy |
| progress-api | `c5ee706867eb` | `cb222edc168be4ff9e50af43555eebc1e9d95f358b5f61b3d4829138f0fadcc0` | healthy |
| mysql | `a874a4f0ab46` | `a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902` | healthy |
| mongo | `c11e8984ca8b` | `b9924c330a8bbc5800fe9c69f04a84e221eca7b28fd049a0354147d9908fa142` | healthy |
| cassandra | `274b64b24986` | `4d020740a8496d0ea571efa55f2e9b1ec4d623c70674b34a91c3b449f082143e` | healthy |
| redis | `d7b516acd286` | `7b1753b4c5ad8458906c272a8132b8c15f5557b000379eb115fb239706a384b7` | healthy |
| clickhouse | `f93db5993ddb` | `d426d2f612e1e189c90f9a3f8dcd85a03c6851273833817a296bb327e63aa7a7` | healthy |

Etiqueta activa frontend: `siare-academico-frontend:0.1.0`. La reversión histórica `siare-academico-frontend:pre-h4-20261119` existe con ID `sha256:fcf1dcfef4b24fc51ac886e48d5a81f2a19e15a9aba81da47895d20e2033b950`. No se cambió ninguna etiqueta ni se construyó/recreó contenedor alguno en esta revisión documental.

Las suites funcionales, capturas productivas nuevas y auditoría H6-6 permanecen pendientes. La salud actual no constituye aprobación del rediseño. Conforme a `AGENTS.md`, esta entrega exclusivamente documental no requiere despliegue.

La verificación documental cotejó las 14 páginas, los 5 manejadores técnicos y los 6 archivos auxiliares contra el árbol H6. La matriz CSV contiene 50 IDs únicos, incluidos los 36 casos internos/transversales; los enlaces relativos de los dos documentos resuelven y no hay espacios finales. Se compararon por SHA-256 475 archivos previos de código, documentación, configuración y skills, incluidos los archivos de integración documental modificados: ninguno cambió. El informe de comprobación queda en la caché local `.cache/h6-coverage/validation.json` del checkout habitual.

Los únicos entregables nuevos de esta revisión son este documento, el inventario global y la matriz CSV, bajo `docs/design/` del worktree H6. Permanecen sin commit ni push. No se ejecutaron suites de aplicación ni build porque no cambió código ejecutable.
