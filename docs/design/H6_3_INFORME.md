# H6-3: Cuaderno abierto funcional y recuperación segura

La implementación conecta Fuentes, Aprendizaje y Estudio con los componentes académicos reales. El trabajo editable pertenece a un controlador por usuario/materia, independiente de la vista. El banco conserva borradores por fuente; los jugadores conservan intentos por actividad. El resumen real del catálogo ya no declara ni muestra `createdAt`.

La recuperación durable es opcional y usa IndexedDB con AES-GCM y una frase local independiente. El recorrido con respuesta perdida conserva el cuerpo y la clave originales incluso después de recargar. La política, parámetros, exclusiones y límites están en [H6_3_RECUPERACION_SEGURIDAD.md](H6_3_RECUPERACION_SEGURIDAD.md).

## Revisión y alcance

- Rama: `feat/h6-3-cuaderno-abierto`.
- Base verificada del PR #10: `371e93efed315492683d2bcb2a793446384c6eb3`, rama `feat/h6-2-nexo-global`, abierto hacia `main`.
- Commit de implementación: `4442b69064a116b820051a5470ec188383e585aa`.
- Preview aislada: `http://127.0.0.1:3107`, proyecto `siare-h6-3-validation`, servicio `frontend-h6`.
- La instalación habitual de 3100 conserva su contenedor e imagen. H6-3 no autoriza sustituirla ni fusionar el PR.

El delta productivo se limita al frontend. No incorpora Flyway V6, generación ML ni cambios de Spring, Flask, Express, bases de datos, redes, volúmenes o credenciales. Los cambios ajenos del checkout principal y la evidencia H6-0/H6-1/H6-2 se conservan. Los PR #8 y #9 quedan fuera de este trabajo.

## Cambios comprobables

`AcademicProvider` permanece bajo el layout privado validado por servidor. Sus controladores sobreviven a la navegación interna autorizada y separan la presentación del dominio. `SubjectWorkspace` integra los tres slots de `WorkspaceColumns`; CSS oculta paneles sin desmontar sus slots. Solo existe un jugador, con estado controlado por actividad.

Fuentes ofrece búsqueda, carga bajo demanda, progreso, procesamiento y descarga autorizada. La lectura vive en el centro y conserva advertencias OCR/C2PA. Estudio contiene accesos compactos. El catálogo se pliega durante una actividad para dejar espacio al Quiz o al Crucigrama. La configuración de la materia se abre bajo demanda en el centro.

El banco conserva JSON, configuración, validación y revisión al cambiar de herramienta. Cambiar de fuente conserva cada borrador e invalida la revisión correspondiente. La huella SHA-256 del texto actual detecta cambios de procedencia antes de publicar. El bloqueo de publicación también pertenece al borrador, para evitar duplicar una creación al cambiar de vista durante el POST.

El controlador congela el envío antes de cualquier espera y lo mantiene hasta obtener confirmación. Un resultado tardío solo actualiza su actividad. Un envío sin resolver no adquiere otra clave. Recargar o montar una vista no ejecuta un POST. Los resultados confirmados se recuperan por ID desde Spring, sin persistir su solucionario.

## Reproducción de las pruebas

Desde `frontend/`, usar Node 24 y las dependencias exactas del lockfile: `npm.cmd ci --no-audit --no-fund`, `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run build` y `npm.cmd run test:integration:activities`. No hay script `lint` en este proyecto.

Para navegador, definir `E2E_BASE_URL=http://127.0.0.1:3107` y `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` con el ejecutable de Chromium instalado, y ejecutar `npm.cmd run test:e2e`. La ejecución registrada usa Chrome 157.0.8103.79.

Las fixtures documentales sintéticas se generan con `services/content-ai/tests/fixture_factory.py`; los controles existentes de `Test-Phase2.ps1` muestran su ejecución y copia desde el procesador, sin reiniciarlo. Este worktree usa `academic.pdf`, `scanned.pdf` y `blank.pdf` en `.cache/phase2-fixtures/`. La prueba adicional C2PA toma `SIARE_TEST_PDF` de la fixture original autorizada de la instalación, con el hash documentado abajo; ese original no se añade al repositorio. Las capturas académicas publicadas usan exclusivamente el PDF sintético de la suite.

## Pruebas y evidencia

Resultado de cierre en la imagen activa `4442b69`: **44 unitarias/componentes, 4 integraciones BFF y 72 pruebas de navegador aprobadas; 0 fallos y 0 flaky**. Se mantienen dos omisiones duplicadas de matriz global/contraste en móvil. TypeScript y build Next.js aprobaron también dentro de Docker.

Los resultados finales por prueba se registran en [pruebas.json](evidencias/h6-3/pruebas.json). Las capturas y sus metadatos están en la [galería de evidencia](evidencias/h6-3/README.md). [runtime.json](evidencias/h6-3/runtime.json) registra imágenes, contenedores, salud y preservación.

| Comprobación | Evidencia |
| --- | --- |
| TypeScript, unitarias/componentes y build Next.js | Checks locales y build Docker; resumen en `pruebas.json` |
| Integración BFF | Cuatro casos con servidor Next real y upstream local controlado; cinco operaciones H3, CSRF, renovación y replay exacto |
| Playwright | Chromium real sobre la imagen de preview y Spring existentes; proyectos escritorio y móvil |
| Catálogo sin fecha | Contrato exacto de Spring y ausencia de fecha ficticia en las tarjetas; DT-02 cubre fechas de evaluación válidas, ausentes e inválidas y America/Bogota |
| Documentos | Carga, cuarentena, READY, rechazo de PDF corrupto, lectura, OCR y C2PA; descarga original con hash `66cdd9f6cd895d4837cd68aa1208d89ca4bf4b9760e2c24e54cbf9e76815735e` |
| Identidad | Registro/login, cookies HttpOnly, renovación, sesiones, MFA USER y denegación administrativa; OIDC de interfaz con respuestas controladas |
| Instalación habitual | `scripts/Test-Siare.ps1`, comparación de los nueve IDs/imágenes y humo de navegador de 3100 |

| Caso | Recorrido ejecutable |
| --- | --- |
| ST-01 | Banco/Catálogo/Banco conserva el JSON; la prueba antes `fixme` está activa en `nexo-recovery.spec.ts`; otra prueba conserva también la revisión |
| ST-02 | Dos fuentes READY y borrador externo independientes; volver recupera contenido y no reutiliza una revisión incompatible |
| ST-03 | Quiz conserva opciones, pregunta y sesión al cambiar herramientas; otra actividad no recibe esas respuestas |
| ST-04 | Crucigrama conserva letras y dirección al abrir lectura y cambiar a móvil |
| ST-05 | Banco revisado conserva contenido y checkbox en 1440/1024/390/320/1920 y al cambiar tema |
| ST-06 | Spring guarda, se pierde HTTP, se cambia de herramienta, se recarga y se recupera; el retry mantiene JSON, duración y clave y devuelve el mismo intento |
| ST-07 | Doble clic produce un envío; una respuesta tardía tras abrir otra actividad queda asociada al intento original |
| ST-08 | Cancelar salida conserva ruta, respuestas y banco; no envía ni archiva. Salida interna confirmada y retorno conservan el banco en memoria |
| ST-09 | Recuperación de banco revisado, celdas/dirección, envío congelado y resultado confirmado; frase incorrecta, cuota, almacenamiento denegado, ciphertext corrupto, versión antigua, caducidad y competencia entre pestañas |
| ST-10 | Logout elimina copia/memoria; B no recibe trabajo de A; una copia retenida por expiración solo vuelve a A tras autenticarse; fallo de purga se comunica tras cerrar la sesión |

Las aserciones originales se conservan. Se añadieron pasos de navegación para acceder a paneles móviles y se espera la actividad abierta antes de enviar. Las únicas omisiones heredadas son dos ejecuciones duplicadas de la matriz global/contraste en el proyecto móvil: esas pruebas ya recorren su matriz interna desde escritorio. No se omite ningún ST-01–ST-10.

## Revisión visual y accesibilidad

La comparación usa la alternativa A aprobada, no una nueva dirección visual. Se conservan Urbanist local, naranja/tinta y tokens Nexo. Se redujo el encabezado y se agrupó el aviso de recuperación para adelantar el trabajo. Los laterales miden 256 y 240 px en escritorio; el centro es flexible. Tableta alterna lateral y móvil muestra un panel con navegación inferior y safe area.

Se capturan vacío, documento seleccionado, lectura, Quiz, Crucigrama, banco en revisión, evaluación y recuperación. Cada estado aparece claro/oscuro en 1440×900, 1920×1080, 768×1024, 390×844 y 320×844. Ambos proyectos de Chromium ejecutan la matriz: 160 PNG. Las mediciones comprueban ausencia de overflow horizontal; las regresiones previas cubren foco, Escape, contraste semántico, forced colors y movimiento reducido. El escalado de fuente al 200 % está probado y no equivale a zoom real de navegador.

## Fallos abiertos, omisiones y etapas posteriores

Las pruebas automáticas no acreditan Firefox/WebKit, lector de pantalla, teclado virtual físico, zoom real del navegador, envío SMTP ni login externo Google/GitLab. OIDC usa un proveedor/control de respuestas identificado como tal. Se mantiene su validación separada.

H6-4 conserva los grupos público/acceso, identidades y administración por ámbito/rol; H6-5 conserva las interacciones y acabados globales. La matriz actualiza únicamente el alcance académico H6-3 y conserva sus filas pendientes. La revisión visual final H6-6 y la autorización de despliegue habitual H6-7 siguen independientes.

El almacenamiento local puede ser denegado o eliminado por el navegador. La recuperación exige una copia confirmada, una frase correcta y autorización actual de Spring. No se promete recuperación del modo en memoria, protección frente a XSS ni sincronización entre equipos. Ante un error de purga en logout, la sesión se cierra y el login informa que la copia cifrada puede seguir en el dispositivo.

## Docker y reversión

Se identificó primero el proyecto habitual `siare-academico`: `compose.datos.yml`, `compose.apps.yml` y el override privado `.local/deployment-h4-20261119/frontend-source.json`. Se aplicaron los controles de `scripts/Common.ps1` sin imprimir configuración expandida ni secretos.

La preview usa una configuración privada acotada a frontend en `.cache/h6-3/preview.compose.json`, red edge existente, puerto loopback 3107, memoria 384 MiB, una CPU y healthcheck. Se ejecuta con `up --detach --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 180 frontend-h6`. La imagen anterior de preview se conserva como `siare-academico-frontend:h6-3-rollback-preview`. No se recrea el frontend habitual ni se reinician otros servicios.

La imagen H6-3 lleva la etiqueta OCI del commit de implementación. Los IDs completos de imagen activa, reversión y contenedores se registran en `runtime.json`; se comprueba la igualdad de los nueve contenedores/imágenes originales antes/después y su salud. La imagen funcional habitual permanece disponible con su etiqueta original. No se eliminan redes, volúmenes ni datos para desplegar o verificar.

## Skills y decisiones

Se aplicaron `ui-ux-pro-max`, `modern-web-guidance`, DakaDesing y su [adaptación SIARE](H6_SKILLS_SIARE.md), y `deslop` para el informe. La referencia ya aprobada evita volver a pedir una elección. La consulta UX `focus not obscured` respaldó el foco visible y los límites de barras persistentes; no se presenta el criterio AAA como una certificación AA.

Modern Web Guidance:

- `responsive-design`: mantuve unidades dinámicas y límites relativos de tipografía siguiendo “Use dynamic viewport units”; evitan depender del alto fijo del navegador móvil.
- `css-layout`: usé centro `minmax(0, 1fr)` y `min-inline-size: 0`; la guía indica “Do NOT use overflow: hidden to mask layout issues”. El crucigrama desplaza solo su cuadrícula y las mediciones detectan el desborde del documento.

Se consultó el método de [frontend-design de claude-webkit](https://github.com/Hainrixz/claude-webkit/blob/main/.claude/skills/frontend-design/SKILL.md) para jerarquía y revisión. La adaptación permite conservar el diálogo nativo Nexo; no se añadió SweetAlert2 ni se sustituyeron APIs globales. El formulario complejo de recuperación permanece en un diálogo accesible y los errores no se autocerran.
