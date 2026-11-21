# Landing · Logo y cristal según el tema

Verificado el 20 de noviembre de 2026, America/Bogota, en http://127.0.0.1:3107/. Rama `feat/h6-landing-access`. HEAD inicial `7ede3ef55bf10ecf9c33d05593c165b6c653d5ac`, worktree limpio. Código desplegado: `3ca1974f75844b6deb5034911298e97ca856548c`. Esta entrega continúa la revisión de la landing; no avanza a H6-6.

## Alcance

Archivos de aplicación modificados: `frontend/src/app/page.tsx` y `frontend/src/components/landing.module.css`. El primero solo añade un marco de encuadre invisible al PNG y ajusta `sizes`; el segundo modifica tamaño/distribución de marca y los tokens del panel. `frontend/tests/e2e/landing.spec.ts` amplía la matriz y las regresiones de tema.

El contenido de bienvenida, las reglas de sus textos, el fondo educativo, las reglas de las cards y el footer conservan su contenido y estilos anteriores. La comparación automatizada de esas reglas CSS pasó. No se cambiaron AuthForm, FederatedLogin, ThemeControl, autenticación, OIDC, MFA, recuperación, workspace A, controlador académico, backend ni H5. No se añadieron dependencias.

## Logo y separación

Solo el hero puede usar hasta 1800 px. Mantiene tres columnas en escritorio amplio: marca, mensaje y acceso. Las cards, header y footer conservan su límite anterior de 1440 px. El acceso conserva 420 px como máximo. La separación entre columnas usa `clamp(32px, 3.4vw, 72px)`; hay una adaptación compacta entre 1101 y 1200 px y se conserva la distribución de tableta/móvil.

El PNG oficial no se modificó: SHA-256 `a120d94b62431789671c20307a4f34e642c5ca935ca7a51f02d2dd08396280b7`. Sus márgenes laterales casi transparentes se encuadran mediante `object-fit: cover` en una caja cuadrada sin decoración. Se mantiene la proporción del dibujo; no hay escala mediante transform, fondo, tarjeta o borde. El núcleo visible del PNG, medido con alfa ≥128, permanece dentro del encuadre.

| Viewport | Caja de layout | Ancho visible antes → después | Posición izquierda visible antes → después |
| --- | --- | --- | --- |
| 1920×1080 | 360×360 px | 256.7 → 316.8 px | 330.0 → 93.1 px |
| 1728×900 | 360×360 px | 256.7 → 316.7 px | 234.0 → 90.2 px |
| 1440×900 | 340×340 px | 227.4 → 299.2 px | 137.3 → 77.5 px |
| 1024×768 | 280×280 px | 176.0 → 246.4 px | Marca apilada sobre el mensaje |
| 768×1024 | 260×260 px | 176.0 → 228.8 px | Centrado |
| 390×844 | 220×220 px | 152.5 → 193.6 px | Centrado |

En escritorio, `--logo-size: clamp(340px, 20.8333vw, 360px)`; entre 1101–1200 px usa 300 px; hasta 1100 px usa 280 px; hasta 800 px, 260 px; hasta 540 px, 220 px. Se limita al ancho disponible. En los tres escritorios amplios queda una separación visible logo/mensaje de 248.2, 168.1 y 72.8 px, respectivamente. Los valores visibles distinguen el dibujo real de los márgenes del archivo.

## Tokens exactos del panel

Los tokens locales siguen `html[data-theme]` y, en ausencia de elección clara, `prefers-color-scheme`. El `color-scheme` nativo se hereda del tema global. No existe un segundo controlador ni un tema oscuro fijo en el panel.

| Token | Claro | Oscuro |
| --- | --- | --- |
| `--access-surface` | `rgb(255 255 255 / .55)` | `rgb(7 9 12 / .55)` |
| `--access-edge` | `rgb(32 34 38 / .28)` | `rgb(255 255 255 / .22)` |
| `--access-reflection` | `rgb(255 255 255 / .65)` | `rgb(255 255 255 / .09)` |
| `--access-shadow` | `rgb(0 0 0 / .22)` | `rgb(0 0 0 / .38)` |
| `--access-tabs` | `rgb(0 0 0 / .045)` | `rgb(0 0 0 / .16)` |
| `--access-opaque` (fallback sin blur) | `#f2f3f4` | `#17191d` |
| `--text` | `#202124` | `#f5f5f5` |
| `--muted` | `#505359` | `#d2d4d7` |
| `--border` | `rgb(32 34 38 / .23)` | `rgb(255 255 255 / .22)` |
| `--control` | `#72757a` | `#93979f` |
| `--input` | `rgb(255 255 255 / .58)` | `rgb(7 9 12 / .36)` |
| `--raised` (selección/deshabilitado) | `rgb(255 255 255 / .68)` | `rgb(255 255 255 / .09)` |
| `--soft` (hover) | `rgb(255 255 255 / .82)` | `rgb(255 255 255 / .13)` |
| `--accent`, `--focus` | `#98400d` | `#ffc393` |
| `--danger` | `#902d39` | `#ffbdc6` |
| `--danger-soft` | `rgb(255 238 240 / .85)` | `rgb(60 20 28 / .75)` |

El panel usa `background: var(--access-surface)`, `backdrop-filter: blur(10px)`, borde de 1 px y `box-shadow: inset 0 1px 0 var(--access-reflection), 0 24px 64px -24px var(--access-shadow)`. No hay degradado azul ni incremento de opacidad para esconderlo. El naranja Nexo se hereda sin cambios.

La transparencia se comprobó también por píxeles: al retirar temporalmente solo la imagen educativa en una página de prueba, conservando el panel, cambiaron todos los píxeles de la región interior muestreada. La diferencia media por canal fue 25.21 en claro y 4.23 en oscuro. Esto confirma una contribución real del fondo a través de la superficie; no es solo una sombra decorativa. [Medición](evidencias/h6-landing-glass/transparency.json).

## Estabilidad y validación

Por encima de 800 px se conserva la reserva estructural anterior: introducción `minmax(6rem, auto)` y formulario `minmax(24rem, auto)`. La variación máxima del hero, panel, logo, título, cards y footer entre login/registro fue **0 px** en 1920, 1728, 1440 y 1024 px, ambos temas. En hasta 800 px se usan filas naturales para reducir el vacío del login; el registro puede crecer sin recortar campos.

| Verificación | Resultado |
| --- | --- |
| Dockerfile oficial: npm test | 45 aprobadas |
| Build de producción y TypeScript | Aprobados |
| Playwright sobre 3107 desplegado | 11 aprobadas; 1 omisión de la repetición de la matriz móvil |
| Capturas | Seis resoluciones solicitadas, ambos temas, login y registro; además 320×812 |
| Tema | Preferencia del sistema, cambio inmediato, persistencia y coincidencia con el tema global |
| Elementos del panel | Superficie, tabs/selección, campos, labels, ayuda, bordes, errores, disabled, foco y hover Google |
| Acceso | Validación nativa, payloads existentes, errores asociados, foco, bloqueo de tabs durante envío |
| Navegación/OIDC | Recuperación, volver, Google/GitLab deshabilitados, error recuperable y redirección interceptada |
| Contraste | 100 muestras aprobadas en claro/oscuro, 1440 y 390 px |
| Accesibilidad adicional | Teclado, colores forzados y movimiento reducido |
| Geometría | Sin overflow horizontal, sin superposición de las tres columnas; cards inferiores |
| Conservación de 3100 | DOM y capturas idénticos; health UP |

Se revisaron visualmente las capturas y se corrigió la distribución en 1440 px para conservar el mensaje en dos líneas. Los screenshots son de página completa; su altura puede superar la del viewport. Los envíos de autenticación se interceptaron; no se crearon cuentas ni se iniciaron sesiones reales. El contraste muestreado no sustituye una auditoría WCAG completa.

## Docker y conservación

| Dato | Valor |
| --- | --- |
| Proyecto / servicio | `siare-h6-3-validation` / `frontend-h6` |
| Puerto | `127.0.0.1:3107 → 3000` |
| Imagen | `siare-academico-frontend:h6-landing-glass` |
| ID de imagen | `sha256:07a9f22ef4bfc0eea667a3084a26680aa8900bca250aee9cb4b0fc9cb6c30267` |
| Contenedor | `fdc5073258db2e39ed026fe61b4acfbd557b219daadb5ae015d61962da3e8d48` |
| Salud | healthy; `/api/health` UP |
| Reversión preservada | `siare-academico-frontend:h6-landing-glass-rollback` |
| Imagen anterior conservada | `sha256:922f8963076e55d5e064c1a60c8bc17ddc146f3918033f4a9b4673c48cd060ce` |

Se aplicaron los controles oficiales `Assert-SiareDocker`, `Assert-SiareOwnership`, `Assert-SiareExclusiveVolumes` y `Test-SiareComposeFiles`. La configuración Compose resuelta solo cambió imagen y etiquetas. Se conservaron entorno efectivo, HostConfig, red, puertos, recursos y ausencia de mounts. Compose reordenó las variables del entorno: se recuperó la huella inicial exacta reordenando únicamente las entradas actuales, demostrando que ningún valor cambió; no se publicaron sus valores.

Desde la raíz habitual se recreó exclusivamente el preview:

```powershell
docker compose -p siare-h6-3-validation `
  -f .cache/h6-3/preview.compose.json `
  -f .cache/h6-5/preview.override.json `
  -f .cache/h6-landing/preview.override.json `
  -f .cache/h6-landing-fine/preview.override.json `
  -f .cache/h6-landing-glass/preview.override.json `
  up -d --no-deps --no-build --pull never --wait --wait-timeout 120 frontend-h6
```

Para volver al preview anterior se omite únicamente el último `-f .cache/h6-landing-glass/preview.override.json`. La etiqueta `h6-landing-fine` y la etiqueta de reversión conservan esa imagen. No se ejecutó la reversión.

Los nueve contenedores habituales conservan IDs, imágenes, creación, arranque, reinicios, configuración, entorno, mounts y redes; todos healthy. El frontend de 3100 sigue siendo `eae9ae80e3c1`, imagen `sha256:c67d08bd4d4ef8e405f1d886ed3fec4c9fdb62f06be117184a8ff68c7c9ff5b0`. Su captura y DOM son idénticos al inicio. Main conserva `c8f934492f0cc7809282657270df34b4474915ca`; los cambios ajenos del checkout principal permanecen intactos. No se modificaron Docker habitual, .env, datos, volúmenes, redes o credenciales. El preview temporal 3117 se cerró.

[Capturas y evidencias](evidencias/h6-landing-glass/README.md). Se consultaron UI/UX Pro Max, Modern Web Guidance (`dark-mode`, `color`) y la documentación local de Next.js sobre CSS Modules e Image.
