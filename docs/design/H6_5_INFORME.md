# H6-5: microinteracciones y acabados Nexo

H6-5 refina la navegación por teclado, la selección y el movimiento de los componentes existentes. La preview usa `http://127.0.0.1:3107`; la instalación habitual de 3100 conserva sus nueve contenedores, imágenes y montajes. El historial de aceptación H6-4 se mantiene en la matriz de 50 casos, con columnas específicas para la verificación H6-5.

La rama `feat/h6-5-nexo-interactions` parte de `56687c678a3260a9f0ceaa24a8101986043de6b1`, HEAD del PR #12 abierto/draft. La implementación inicial está en `e473f95`; `06000f6ec47fc0bfe467de05456c5e25ca9cce76` incorpora el progreso Nexo y es la revisión del runtime final. Los commits posteriores contienen pruebas y documentación. El PR draft H6-5 se dirige a `feat/h6-4-nexo-integral`; no se fusiona ni modifica #8–#12.

## Cambios comprobables

La [auditoría priorizada](H6_5_AUDITORIA.md) explica los hallazgos y la decisión por componente. La [comparación visual](H6_5_COMPARACION.md) enlaza capturas antes/después de la instalación efectiva y distingue las fixtures administrativas.

| Componente | Comportamiento final |
| --- | --- |
| Rail y encabezado | Hover, apertura activa y foco conservan los tokens Nexo. Los desplegables nativos son exclusivos; mantienen Tab, Enter, Space, Escape y cierre exterior. Salir con Tab cierra el menú. Pasar del menú móvil a escritorio restaura un activador visible y conserva el formulario. No se cambian rutas ni breadcrumbs. |
| Fuentes y Estudio | La fuente seleccionada añade borde/contorno. Un filtro sin coincidencias explica cómo recuperar la lista. Los accesos de herramientas y paneles muestran `aria-pressed` con una señal común. Carga bajo demanda, READY, cuarentena, descarga y mensajes documentales mantienen sus contratos. |
| Catálogo y Quiz | Abrir una actividad enfoca el título del jugador cuando el servidor responde. Pregunta y grupo de opciones quedan relacionados. Un progreso nativo indica preguntas respondidas; no representa aciertos. Anterior/Siguiente conservan el índice y el foco. Pending bloquea el envío y la evaluación autorizada se anuncia como estado. |
| Crucigrama | La celda enfocada y la dirección determinan la pista actual. La relación se expone con `aria-describedby`; pista y palabra reciben señal visual. Flechas, Enter, Retroceso, celdas y envío siguen en el jugador existente. La interfaz no conoce las respuestas esperadas antes de evaluar. |
| Consulta de intentos | Cada UUID inválido recibe su error asociado; el foco llega al primero y ambos valores se conservan. Un guard síncrono impide consultas duplicadas. El rechazo del servidor enfoca el aviso contextual. |
| Recuperación local | El error recibe foco dentro del diálogo y un guard evita ejecuciones duplicadas antes del render de pending. Se mantienen frase/valores para corregir el fallo. El esquema cifrado y los controles de recuperación H6-3 permanecen idénticos. |
| Formularios, diálogos y avisos | Las primitivas existentes reciben el movimiento compartido. Login, registro, recuperación, MFA, materia, sesiones y administración conservan la validación, confirmaciones, cancelación y respuesta autorizada H6-4. |

Los controladores académicos, proveedor, contratos BFF, política de recuperación, paleta, fuente, manifiestos y lockfile coinciden con la base. No se modifica Spring, Python, Express, migraciones o almacenamiento. El cambio no añade dependencias ni otro componente de diálogo/jugador.

## Movimiento y preferencias

Los controles y desplegables usan `--duration-fast: 140ms`; avisos, resultados y revelado de paneles usan `--duration: 220ms`, con `--ease` de H6-1. Las transiciones de control afectan color/borde/sombra y los revelados afectan opacidad. No se animan rejillas, alturas, escritura o recuentos de calificación.

La apertura del desplegable hace visible el contenido inmediatamente: la animación no condiciona Tab ni el foco. El cierre usa `::details-content` y transición discreta como mejora progresiva. Navegadores sin esa capacidad mantienen apertura/cierre nativos inmediatos. La exclusividad `name` conserva el fallback `onToggle` existente. La lista de enlaces sigue siendo navegación con Tab, sin un rol `menu` que exigiría otro modelo de teclado.

Las animaciones nuevas solo existen con `prefers-reduced-motion: no-preference`; la regla global H6-4 sigue anulando transiciones con reduce. Forced colors usa contornos Highlight para selección/foco, y Canvas/Highlight en el progreso. El progreso nativo conserva su semántica y recibe los colores Nexo por selectores de motor, conforme a la [referencia Blink/WebKit](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::-webkit-progress-value) y la [referencia Firefox](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::-moz-progress-bar). La compatibilidad visual real de Firefox/WebKit queda pendiente.

## Pruebas y conservación académica

El [registro por prueba](evidencias/h6-5/pruebas.json) contiene el resultado de cierre. TypeScript, 45 unitarias/componentes y build Next.js pasan localmente y en el Dockerfile oficial. Las integraciones de la compilación final aprueban cuatro casos BFF H3, seis OIDC controlados y cinco recorridos controlados de administración, seguridad y errores.

Playwright completo sobre la imagen final aprueba **87 casos, cero fallos, cero flaky y tres omisiones históricas por duplicación**, en 7,2 minutos. Las ocho pruebas nuevas pasan en escritorio y móvil. Las tres omisiones son la repetición móvil de la matriz global Nexo, su contraste semántico y la matriz de estados académicos internos; sus escenarios ya recorren los ocho tamaños en sus matrices propias. No se añade ninguna omisión.

Las pruebas nuevas ejercitan foco rápido al abrir, salida con Tab, Escape/restauración, exclusividad, puntero exterior, cambios de breakpoint, progreso/pregunta, pista/celda, envío pendiente, errores de UUID y búsqueda/selección de fuentes. Esta última usa metadatos/texto controlados; las regresiones documentales separadas usan Spring y documentos sintéticos reales.

La suite completa conserva ST-01–ST-10: bancos por fuente y revisión, respuestas/celdas/índice/dirección, cambios de herramienta/panel/tema/tamaño, retorno a materia, cuenta A/B, expiración, concurrencia, recuperación cifrada y descarte. La respuesta perdida y el reintento conservan cuerpo, duración y clave originales, sin POST al montar o recargar. Los resultados solo proceden de la evaluación autorizada de Spring.

Las regresiones incluyen cuarentena, procesamiento, OCR, READY/FAILED, lectura sin iframe/object/embed, descarga íntegra C2PA, MFA con cuentas USER sintéticas, CSRF, sesiones, cancelación y administración por upstream controlado. El original C2PA autorizado se usa en la caché privada y no se publica. Las capturas MFA ocultan QR, semilla, códigos y contraseñas antes de escribir PNG. El informe distingue los roles simulados del rechazo USER real; no se elevan identidades.

Durante la validación se corrigieron el foco rápido del desplegable, su restauración al cambiar de breakpoint y un supuesto de la prueba sobre el orden de preguntas, que Spring aleatoriza. Una ejecución inicial completa se interrumpió para corregir el color nativo del progreso. El resultado de cierre corresponde a la imagen final; las ejecuciones parciales no cuentan como suite aprobada.

## Rendimiento

La [medición reproducible](H6_5_RENDIMIENTO.md) compara la imagen H6-4 activa con la imagen final H6-5. Incluye bytes JS/CSS y gzip, seis navegaciones por ruta, CLS observado y actividad DOM/layout/tareas en reposo. La misma cuenta sintética y materia permiten comparar `/login`, `/inicio` y el cuaderno.

No se afirma una mejora de rendimiento. Los tiempos son observaciones locales sobre Docker Desktop, sin aislamiento estadístico ni throttling de un equipo modesto. El observador no sustituye React Profiler ni pruebas de campo. No se añaden animaciones permanentes, timers de efectos visuales, listeners de scroll o renderizados por frame.

## Docker y reversión

El proyecto activo es `siare-h6-3-validation`, servicio `frontend-h6`, contenedor `9e4ecb00cb952eef7c916664c706b20cf29bfda55a471865928584acda068fee`. Imagen `siare-academico-frontend:h6-5-isolated`, ID `sha256:2f2dc7f3dc37453f605a57825c2c6f2946199b6f0f712908eb64ea41089c53c1`, revisión OCI `06000f6ec47fc0bfe467de05456c5e25ca9cce76`. Esperó healthy y `/api/health` respondió UP. Los detalles están en [runtime.json](evidencias/h6-5/runtime.json).

La configuración base sigue en `.cache/h6-3/preview.compose.json`; `.cache/h6-5/preview.override.json` cambia solo imagen y etiquetas del servicio. Conserva 384 MiB, una CPU, loopback 3107, red edge externa y ausencia de montajes. Se aplicaron los controles de propiedad, Compose y volúmenes de `Common.ps1` antes de recrear.

```powershell
docker compose --project-name siare-h6-3-validation --file .cache/h6-3/preview.compose.json --file .cache/h6-5/preview.override.json up --detach --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 180 frontend-h6
```

Reversión: la imagen previa permanece en `siare-academico-frontend:h6-4-before-h6-5`, ID `sha256:515ff308e35238bdb146dd3dcaa645b7a650efdd2dde9c05f7dff36b7d8067e4`. Usar el mismo comando selectivo con `.cache/h6-4/preview.override.json` como segundo archivo y esperar healthy. Su etiqueta original `h6-4-isolated` también se conserva. No hacen falta limpieza, eliminación de contenedores habituales ni borrado de datos.

`Test-Siare.ps1` pasó sobre la instalación habitual; la comparación de nueve IDs, imágenes y montajes y el hash de `.env` es idéntica. Portada/login de 3100 se comprobaron en navegador; no se desplegó allí. El checkout principal conserva sus cambios ajenos y su rama `fix/document-compatibility-isolation`.

[conservacion.json](evidencias/h6-5/conservacion.json) coteja los blobs Git de doce archivos críticos con la base, además de BFF, servicios y Compose. [habitual-browser.json](evidencias/h6-5/habitual-browser.json) registra el humo de navegador y salud de 3100.

## Reproducción

Desde `frontend/` del worktree H6-5, con Node 24, Chrome instalado y las dependencias exactas del lockfile:

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
$env:NEXO_EVIDENCE_DIR='../.cache/h6-5/nexo'
$env:ACADEMIC_EVIDENCE_DIR='../.cache/h6-5/academic'
npm.cmd run test:e2e
```

La suite documental requiere `academic.pdf`, `scanned.pdf` y `blank.pdf` en `.cache/phase2-fixtures/` del worktree; se reutilizaron las fixtures sintéticas H6-4. `SIARE_TEST_PDF` apuntó al original autorizado de la caché del checkout principal para la comprobación C2PA adicional. Los scripts `tests/measure-h6.mjs` y `tests/measure-h6-idle.mjs` documentan la comparación de rendimiento; su sesión queda en `.cache` ignorada. No hay script lint en el manifiesto.

## Pendientes precisos de H6-6

- Firefox y WebKit reales: cierre nativo, colores de progreso, foco de celdas, selección y recuperación con sus APIs disponibles.
- Lector de pantalla real: anuncios de pregunta, progreso/resultado y avisos; orden/verbosity de pista, validación y diálogos. La automatización no certifica WCAG.
- Zoom real del navegador al 200 %, dispositivos físicos, teclado virtual, safe areas y cambios de orientación. Los ocho viewports y el escalado tipográfico no sustituyen esas verificaciones.
- ADMIN/SUPERADMIN con identidades autorizadas y MFA real; Google/GitLab y vinculación externa; entrega SMTP y reset exitoso. Las fixtures de administración/OIDC y las respuestas uniformes de recuperación no los acreditan.
- Lease PROCESSING expirado en un entorno autorizado y capturas transitorias de skeleton en los otros siete tamaños, preservando trabajos reales.
- Contraste de píxeles con transparencia y estados combinados; perfil React y mediciones de campo/equipos modestos para atribuir costes y detectar commits repetitivos fuera del reposo observado.

## Referencias de trabajo

Se aplicaron UI/UX Pro Max (`focus not obscured`), [DakaDesing adaptado a SIARE](H6_SKILLS_SIARE.md), Modern Web Guidance y deslop para el informe. La revisión de componentes sigue el método de [claude-webkit](https://github.com/Hainrixz/claude-webkit/blob/main/.claude/skills/frontend-design/SKILL.md) y las [reglas de interfaz](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md), manteniendo la identidad Nexo elegida.

### Modern Web Guidance

- `natural-interactions`: mantuve foco visible y activación nativa por teclado, siguiendo “Make every action reachable without a mouse”. Los estados de selección y foco tienen señales independientes.
- `accordion`: conservé `details` y añadí exclusividad nativa, con el fallback existente: “add the same `name` to each `details` element”. La apertura nunca retrasa la visibilidad del contenido.
- `motion`: habilité los revelados solo con no-preference, siguiendo “Keep the final state”. El movimiento reducido conserva contenido, foco y selección sin esperar eventos de animación.
