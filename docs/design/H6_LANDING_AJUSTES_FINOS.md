# SIARE · Ajustes finos de la landing

Verificado el 20 de noviembre de 2026 (America/Bogota) en http://127.0.0.1:3107/. Rama `feat/h6-landing-access`, código desplegado `8c056c61a6f9dec5e40356d5730bbaa173dc2434`. El trabajo parte de `d67ec7d`, commit documental posterior a la referencia `d30e7c3`. Los commits de implementación son `609a2a6` (composición y estabilidad) y `8c056c6` (foco de errores). No se fusionaron PR ni se alteró main.

La composición de escritorio separa marca a la izquierda, mensaje completo en el centro y acceso a la derecha. Las tres cards permanecen como bloque inferior con alturas iguales. En tableta y móvil el contenido se apila siguiendo el orden del documento.

El PNG oficial ya tenía transparencia: 1 061 214 de sus 1 572 864 píxeles son completamente transparentes. Se conserva su SHA-256, se elimina la caja y el padding que añadía CSS y se aumenta su presencia. Una sombra fina sobre la silueta ayuda a distinguir el texto oscuro del logo en el tema oscuro, sin añadir un fondo rectangular. El mensaje conserva tanto «Tu espacio de aprendizaje» como «Un lugar para empezar.», «Una materia a la vez.» y la introducción completa.

El acceso usa un degradado de azul oscuro, bordes translúcidos y blur de 10 px, frente a los 26 px anteriores. Sus variables de color son locales; conserva la tipografía y el acento naranja de Nexo. La superficie es oscura en ambos temas y el fondo educativo conserva el tema elegido.

La estabilidad usa dos filas de CSS Grid, en el flujo normal, con mínimos para la introducción y el formulario de tres campos. Los mínimos se adaptan al ancho y usan rem. Solo hay un formulario montado: no hay formularios duplicados, campos invisibles, altura animada ni recorte. Los errores extensos pueden crecer en el flujo normal para no ocultar información. Al alternar las pestañas sin errores, la variación medida de las posiciones y dimensiones del hero, panel, introducción, logo, título, cards y footer fue **0 px** en los doce pares tema/ancho. Se comprobaron ocho selecciones por combinación.

La primera suite detectó que el foco del resumen de errores podía solicitarse antes de que React montara el elemento. Se trasladó a un efecto posterior al render y se verificaron dos envíos fallidos consecutivos en escritorio y móvil. Este ajuste es de presentación y accesibilidad: conserva endpoints, payloads, cookies, validación, MFA y redirecciones existentes.

## Validación

| Comprobación | Resultado |
| --- | --- |
| Dockerfile oficial: npm test | 45 aprobadas |
| Build de producción y typecheck | Aprobados |
| Playwright contra 3107 real | 9 aprobadas; 1 omitida porque la matriz ya incluye móvil |
| Matriz | 1440×1000, 1280×900, 1024×768, 768×1024, 390×844, 320×812; claro/oscuro; login/registro |
| Geometría entre tabs | 0 px de diferencia; repetición de selecciones; sin overflow horizontal |
| Accesibilidad | Flechas, Inicio, foco, tema persistente, movimiento reducido y colores forzados |
| Errores de formularios | aria-invalid, aria-describedby, resumen enfocado y segundo error consecutivo |
| Proveedores | Iconos Google/GitLab, disponibilidad real y estados interceptados de error/redirección |
| Contraste renderizado | 100 muestras aprobadas; no equivale a una auditoría WCAG completa |
| 3100 | DOM idéntico; capturas antes/después idénticas por SHA-256; health UP |

Los envíos de formularios y el inicio externo se interceptaron en Playwright; no se crearon cuentas ni se completaron autenticaciones reales. La disponibilidad de proveedores se consultó contra la instalación. Se revisaron capturas de escritorio, tableta y móvil. [Capturas y datos](evidencias/h6-landing-fine/README.md).

## Despliegue aislado

| Dato | Valor |
| --- | --- |
| Compose | `siare-h6-3-validation` |
| Servicio | `frontend-h6` |
| Puerto | `127.0.0.1:3107 → 3000` |
| Imagen | `siare-academico-frontend:h6-landing-fine` |
| Imagen activa | `sha256:922f8963076e55d5e064c1a60c8bc17ddc146f3918033f4a9b4673c48cd060ce` |
| Contenedor | `96a39276b5b3ad920cc4e2e6d130747d718307683a1e78a949357af7dcd4c2cf` |
| Salud | healthy; `/api/health` UP |
| Reversión | `siare-academico-frontend:h6-landing-fine-rollback-20261120` |
| Imagen conservada para reversión | `sha256:71f8b6b2eb6f196343e73d7ddb3e8ab1e446f10edf79ab01278deb1351599a48` |

Se identificaron proyecto e imagen activos antes de intervenir. Se aplicaron `Assert-SiareDocker`, `Assert-SiareOwnership`, `Assert-SiareExclusiveVolumes` y `Test-SiareComposeFiles` de `scripts/Common.ps1`. La comparación de la configuración Compose resuelta solo permite cambiar imagen y etiquetas. Se conservan la red externa, los puertos, 384 MiB, una CPU, healthcheck, entorno y ausencia de mounts. El preview temporal 3117 se cerró.

Desde la raíz habitual, el despliegue selectivo usa:

```powershell
docker compose -p siare-h6-3-validation `
  -f .cache/h6-3/preview.compose.json `
  -f .cache/h6-5/preview.override.json `
  -f .cache/h6-landing/preview.override.json `
  -f .cache/h6-landing-fine/preview.override.json `
  up -d --no-deps --no-build --pull never --wait --wait-timeout 120 frontend-h6
```

Para restaurar el preview de referencia se omite únicamente el último `-f .cache/h6-landing-fine/preview.override.json`. La imagen inicial y su etiqueta de reversión permanecen disponibles. No se ejecutó la reversión.

Los nueve servicios habituales conservan exactamente IDs, imágenes, fechas, reinicios, hashes de configuración, mounts y redes. Todos siguen healthy. El frontend de 3100 sigue siendo `eae9ae80e3c1`, imagen `sha256:c67d08bd4d4ef8e405f1d886ed3fec4c9fdb62f06be117184a8ff68c7c9ff5b0`. El estado ajeno del checkout principal se conservó. No se cambiaron backend, H5, .env, secretos, volúmenes ni el Docker habitual.

## Reproducir la suite

Desde `.worktrees/h6-5/frontend`, con Chromium local:

```powershell
$env:E2E_BASE_URL = 'http://127.0.0.1:3107'
$env:LANDING_EVIDENCE_DIR = '../docs/design/evidencias/h6-landing-fine'
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = 'C:/Users/Daniel Giraldo/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'
npx.cmd playwright test tests/e2e/landing.spec.ts
```

Se consultaron UI/UX Pro Max, Modern Web Guidance (`tabs`, `forms`) y la documentación local de Next.js para CSS Modules, Image y componentes cliente. Se conserva el teclado existente sin añadir dependencias; el indicador seleccionado usa subrayado con borde y el foco de errores se solicita tras el render.
