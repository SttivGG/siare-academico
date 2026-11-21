# Landing: bienvenida y acceso en el centro

Verificado el 20 de noviembre de 2026, America/Bogota, en http://127.0.0.1:3107/. Rama `feat/h6-landing-access`, worktree `.worktrees/h6-5`. Código desplegado: `95c215e2f1f6629ebf33e1a0bd529d92169d0828`, precedido por `c1bfb022c3db3604b8cf9ec50869d6f173801607`. Base de esta entrega: `ab1e9d8a9dda52de5cbf439f7dc0e6a1c3a4ab5a`.

## Resultado

El logo oficial permanece grande, transparente y separado a la izquierda en escritorio. La bienvenida ocupa la parte superior de la columna central y el panel de acceso queda inmediatamente debajo, con 28 px de separación y los mismos bordes laterales. La columna derecha queda vacía para mostrar la fotografía. Las tres cards siguen debajo del hero.

La composición usa Grid para las columnas y Flexbox para la secuencia bienvenida → acceso. Hasta 900 px se convierte en una columna: logo, bienvenida, acceso y cards. No hay posicionamiento absoluto del contenido ni recortes para ocultar desbordamientos.

El fondo utiliza carbón neutro `#181818` en oscuro y gris `#f4f4f4` en claro. La fotografía original conserva su archivo y recibe `grayscale(1)` únicamente en su capa CSS; así se elimina también el marrón presente en la foto. El overlay usa el color neutro con menos opacidad hacia la derecha. El logo mantiene sus colores y el panel conserva el cristal y sus tokens adaptados al tema global.

Las filas del panel reservan espacio para ambas pestañas en todos los tamaños. En móvil se reserva también la introducción partida y el campo adicional del registro. Son mínimos en unidades rem: los mensajes pueden crecer en el flujo normal. El naranja de la bienvenida en claro se ajustó a `#843b12` para conservar contraste sobre la nueva composición del fondo.

Solo cambiaron dos archivos de aplicación: `frontend/src/app/page.tsx` y `frontend/src/components/landing.module.css`. Se actualizó la regresión de geometría en `frontend/tests/e2e/landing.spec.ts`. Permanecen intactos los textos, PNG oficial, fotografía fuente, AuthForm, LandingAccess, FederatedLogin, ThemeControl, autenticación, MFA, proveedores, workspace académico y servicios backend. No se añadieron dependencias.

## Capturas antes y después

Todas las capturas proceden del navegador contra el servicio real. Son de página completa; las cards permanecen abajo aunque la página supere la altura del viewport.

| Vista | Antes | Después: login | Después: registro |
| --- | --- | --- | --- |
| Escritorio oscuro, 1440×900 | [Antes](evidencias/h6-landing-layout/3107-before-dark-desktop.png) | [Login](evidencias/h6-landing-layout/3107-after-dark-desktop-login.png) | [Registro](evidencias/h6-landing-layout/3107-after-dark-desktop-register.png) |
| Escritorio claro, 1440×900 | [Antes](evidencias/h6-landing-layout/3107-before-light-desktop.png) | [Login](evidencias/h6-landing-layout/3107-after-light-desktop-login.png) | [Registro](evidencias/h6-landing-layout/3107-after-light-desktop-register.png) |
| Tableta oscura, 768×1024 | [Antes](evidencias/h6-landing-layout/3107-before-dark-tablet.png) | [Login](evidencias/h6-landing-layout/3107-after-dark-tablet-login.png) | [Registro](evidencias/h6-landing-layout/3107-after-dark-tablet-register.png) |
| Móvil claro, 390×844 | [Antes](evidencias/h6-landing-layout/3107-before-light-mobile.png) | [Login](evidencias/h6-landing-layout/3107-after-light-mobile-login.png) | [Registro](evidencias/h6-landing-layout/3107-after-light-mobile-register.png) |

Hay 36 capturas en [evidencias/h6-landing-layout](evidencias/h6-landing-layout), incluidas las comparaciones de 3100.

## Pruebas

| Comprobación | Resultado |
| --- | --- |
| Dockerfile oficial: pruebas unitarias | 45 aprobadas, 0 fallos |
| Build de producción y TypeScript | Aprobados |
| Playwright sobre 3107 desplegado | 11 aprobadas; 1 omisión de la repetición móvil de la matriz |
| Matriz de distribución | 1920×1080, 1728×900, 1440×900, 1024×768, 768×1024, 390×844 y 320×812; ambos temas y pestañas: 28 estados |
| Estabilidad al cambiar pestañas repetidamente | Variación máxima de posición/tamaño: **0 px** en hero, panel, introducción, logo, título, cards y footer |
| Breakpoints adicionales | 360, 375, 540, 800, 844, 900, 901, 1100, 1200 y 1280 px; incluye móvil horizontal 844×390 |
| Distribución | Bienvenida encima del panel, bordes alineados, logo separado y derecha libre en escritorio; cards debajo; sin superposiciones ni overflow horizontal |
| Temas | Sistema, cambio inmediato, persistencia, superficies, campos, foco, hover, errores y disabled |
| Acceso | Validación nativa, payloads existentes, errores asociados, foco, bloqueo de pestañas durante envío y recuperación |
| Google/GitLab | Disponibilidad real en la matriz; pruebas interceptadas de disabled, error y redirección |
| Contraste | 100 muestras en claro/oscuro, 1440 y 390 px: 0 fallos; teclado en colores forzados aprobado |
| Fondo neutro | 1024 muestras de píxeles del fondo derecho por tema: diferencia máxima entre canales RGB = 0 |
| 3100 | DOM y PNG exactamente idénticos al antes; nueve contenedores originales saludables |

Los envíos de autenticación y redirecciones externas de las regresiones se interceptaron: no se crearon cuentas ni sesiones reales. La medición de contraste muestrea el fondo renderizado con los glifos ocultos y no constituye una auditoría WCAG completa.

Evidencias: [resumen](evidencias/h6-landing-layout/validation-summary.json), [geometría](evidencias/h6-landing-layout/layout-geometry.json), [breakpoints](evidencias/h6-landing-layout/breakpoints.json), [contraste](evidencias/h6-landing-layout/contrast.json), [Playwright](evidencias/h6-landing-layout/playwright.txt), [build](evidencias/h6-landing-layout/build.txt) y [conservación visual de 3100](evidencias/h6-landing-layout/habitual-browser.json).

Para repetir la regresión desde `.worktrees/h6-5/frontend` en PowerShell:

```powershell
$env:E2E_BASE_URL='http://127.0.0.1:3107'
$env:LANDING_EVIDENCE_DIR='../docs/design/evidencias/h6-landing-layout'
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:/Users/Daniel Giraldo/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'
npm.cmd run test:e2e -- landing.spec.ts
```

## Despliegue selectivo y reversión

| Dato | Valor |
| --- | --- |
| Proyecto / servicio | `siare-h6-3-validation` / `frontend-h6` |
| Puerto | `127.0.0.1:3107 → 3000` |
| Imagen activa | `siare-academico-frontend:h6-landing-layout` |
| ID de imagen activa | `sha256:7f71a64b93e6d27e6785d8cee70572e78d7a85ccbfb8f228dd2704adb544a1ed` |
| Contenedor activo | `c8183949f8963032de8b7d8431c2372fce6acd9b3b10c7ebb40fb77c0be5667f` |
| Estado | healthy; `/api/health` UP en 3107 y 3100 |
| Reversión conservada | `siare-academico-frontend:h6-landing-layout-rollback` |
| ID de reversión, imagen original de 3107 | `sha256:07a9f22ef4bfc0eea667a3084a26680aa8900bca250aee9cb4b0fc9cb6c30267` |
| Contenedor original de 3107 | `fdc5073258db2e39ed026fe61b4acfbd557b219daadb5ae015d61962da3e8d48` |

Se identificaron primero los proyectos e imágenes activos y se ejecutaron los controles oficiales de Docker, propiedad, exclusividad de volúmenes y validez de Compose. Se construyó con el Dockerfile oficial. La configuración resuelta solo cambió imagen y etiquetas de la preview; se recreó exclusivamente `frontend-h6` con `--no-deps --no-build --pull never --wait --wait-timeout 120` y se esperó healthy.

Se mantuvieron los cinco manifests previos y se añadió `.cache/h6-landing-layout/preview.override.json`. La configuración anterior sigue apuntando a la imagen original `siare-academico-frontend:h6-landing-glass`, también conservada. Para revertir únicamente 3107 desde la raíz del repositorio:

```powershell
docker compose -p siare-h6-3-validation -f .cache/h6-3/preview.compose.json -f .cache/h6-5/preview.override.json -f .cache/h6-landing/preview.override.json -f .cache/h6-landing-fine/preview.override.json -f .cache/h6-landing-glass/preview.override.json up -d --no-deps --no-build --pull never --wait --wait-timeout 120 frontend-h6
```

El registro compara IDs, imágenes, creación, arranque, reinicios, salud, huellas de configuración/entorno/HostConfig/mounts y redes de los nueve contenedores habituales. Todos permanecen iguales. En la preview se preservaron entorno efectivo, HostConfig, mounts y red. Se verificaron además las huellas de `.env`, logo y fotografía originales y el HEAD de main, `c8f934492f0cc7809282657270df34b4474915ca`.

No se alteraron redes, volúmenes persistentes ni claves. Los cambios ajenos del worktree principal siguen presentes. No se fusionó ni publicó ningún PR. El [registro de despliegue](evidencias/h6-landing-layout/deployment-verification.json) y los snapshots [antes](evidencias/h6-landing-layout/runtime-before.json) / [después](evidencias/h6-landing-layout/runtime-after.json) contienen huellas, sin valores de credenciales.

## Modern Web Guidance

- **`css-layout`**: Usé anchura del contenedor y tracks flexibles para evitar que el hero desborde por el ancho de la barra de desplazamiento: “Don't use `100vw` for full-width layout”.
- **`responsive-design`**: Combiné rem y viewport dentro de `clamp()` para que el título escale manteniendo límites relativos al texto: “combine viewport-relative and font-relative units”.
