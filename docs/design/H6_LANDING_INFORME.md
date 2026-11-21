# H6 · Corrección de la landing pública

Verificado el 20 de noviembre de 2026 en `http://127.0.0.1:3107/`. Rama `feat/h6-landing-access`; implementación `c852a7b80ecba98ccc595c2f88345eb7c0535f35`, corrección de contraste y código desplegado `d30e7c3ec675bbbcb0bf54e64564484645b8c2f5`. Entrega mediante commits locales, sin PR fusionado ni cambios en main.

La landing elimina el panel «Reúne tus fuentes…» y la antigua barra. Conserva un único control de tema con sol/luna, presenta el logo oficial junto a la bienvenida, incorpora las pestañas de acceso y desplaza las tres cards al bloque inferior. El panel y las cards usan desenfoque, bordes translúcidos y sombras con los colores y la tipografía Nexo. El fondo educativo es local y lleva overlay; sus recursos y el prompt están documentados en la [evidencia visual](evidencias/h6-landing/README.md).

`LandingAccess` reutiliza `AuthForm` y `FederatedLogin`. Las nuevas opciones de presentación son optativas; los consumidores anteriores conservan su presentación. No se cambiaron endpoints, transporte, credenciales, cookies, redirecciones, disponibilidad OIDC, MFA, backend, bases de datos, H5 ni la alternativa A del workspace. No se añadieron dependencias. Los cambios ajenos del checkout principal se conservaron.

Las pestañas admiten flechas, Inicio y Fin, foco visible y selección programática. Solo existe un formulario activo, con los mismos nombres de campo y asociaciones de errores. Durante un envío se impide cambiar de pestaña. El tema conserva la preferencia existente y respeta el tema del sistema antes de una elección explícita. El logo original mantiene su hash y se apoya sobre una base clara para conservar la legibilidad.

## Despliegue selectivo

| Dato | Valor |
| --- | --- |
| Proyecto Compose | `siare-h6-3-validation` |
| Servicio | `frontend-h6` |
| Puerto | `127.0.0.1:3107 → 3000` |
| Imagen final | `siare-academico-frontend:h6-landing-d30e7c3` |
| ID de imagen final | `sha256:71f8b6b2eb6f196343e73d7ddb3e8ab1e446f10edf79ab01278deb1351599a48` |
| Contenedor final | `05ed3c751c40e6915d626d2652be58d9eb60fcbb70a0b72b8f9d01140cf7ac33` |
| Salud final | `healthy`; `/api/health` devuelve `{"service":"frontend","status":"UP"}` |
| Reversión preservada | `siare-academico-frontend:h6-landing-rollback-20261120` |
| ID de imagen anterior | `sha256:2f2dc7f3dc37453f605a57825c2c6f2946199b6f0f712908eb64ea41089c53c1` |

Se usó el Dockerfile oficial, que ejecutó pruebas, build de producción y typecheck. Se identificaron primero las etiquetas del contenedor activo. La configuración existente `.cache/h6-3/preview.compose.json` y `.cache/h6-5/preview.override.json` se complementó con `.cache/h6-landing/preview.override.json`, que solo selecciona imagen y etiquetas. Se aplicó desde la raíz habitual:

```powershell
docker compose -p siare-h6-3-validation `
  -f .cache/h6-3/preview.compose.json `
  -f .cache/h6-5/preview.override.json `
  -f .cache/h6-landing/preview.override.json `
  up -d --no-deps --no-build --pull never --wait --wait-timeout 120 frontend-h6
```

Solo H6 se recreó. Se conservan su entorno —comparado mediante huella, sin publicar valores—, puertos, red externa `siare-academico_edge`, ausencia de mounts, límite de 384 MiB, 1 CPU, healthcheck y controles Compose. No se borraron imágenes, redes, volúmenes ni datos. La segunda actualización selectiva incorporó la corrección de contraste detectada durante la validación. El proceso temporal de desarrollo en 3117 se cerró.

Para volver a la imagen previa se puede ejecutar el mismo comando omitiendo exclusivamente el último `-f .cache/h6-landing/preview.override.json`; la imagen original `h6-5-isolated` también permanece disponible. No se ejecutó una reversión.

## Conservación de 3100

El frontend habitual conserva el contenedor `eae9ae80e3c14891bd844a492afbae59e920812b44de53c11915fda63c92829d` y la imagen `sha256:c67d08bd4d4ef8e405f1d886ed3fec4c9fdb62f06be117184a8ff68c7c9ff5b0`. Su fecha de creación, configuración, entorno, red, puertos, recursos y mounts coinciden con el estado inicial. Sigue healthy y su health devuelve UP. Los contenedores de los otros servicios conservan sus IDs.

La comprobación en navegador confirmó que el HTML de `main` de 3100 coincide exactamente. Sus capturas antes/después también son idénticas por SHA-256. Véanse [runtime inicial](evidencias/h6-landing/runtime-before.json), [runtime final](evidencias/h6-landing/runtime-final.json) y [capturas](evidencias/h6-landing/README.md).

## Pruebas

| Verificación | Resultado |
| --- | --- |
| `npm test` en la imagen final | 45 aprobadas |
| `npm run build` y `npm run typecheck` en la imagen final | Aprobados |
| Playwright `landing.spec.ts`, base URL 3107 | 9 aprobadas; 1 omitida porque repetiría la matriz completa en el proyecto móvil |
| Matriz visual real | 1440 × 1000, 768 × 1024, 390 × 844 y 320 × 812; claro/oscuro; login/registro; sin overflow horizontal ni errores JavaScript |
| Tema | Sistema oscuro inicial, cambio claro/oscuro, persistencia tras recarga |
| Pestañas | Clic, flechas, Inicio, foco y bloqueo durante envío |
| Formularios | Restricciones nativas, transporte existente, errores inline asociados por `aria-describedby`/`aria-invalid`, resumen de errores y foco |
| Google/GitLab | Iconos y disponibilidad real comprobados; ambos aparecen habilitados en esta instalación |
| Proveedores con respuestas controladas | Deshabilitado, error recuperable y redirección correcta para Google y GitLab, en escritorio/móvil |
| Navegación | Recuperar contraseña, volver a landing, carga de `/login` y `/registro` |
| Contraste sobre el fondo renderizado | 100 comprobaciones aprobadas; [mediciones y método](evidencias/h6-landing/contrast.json) |
| Accesibilidad adicional | Enlace de salto, foco por teclado, colores forzados y movimiento reducido |

Los envíos de login/registro y el inicio externo se interceptaron con respuestas controladas en Playwright. No se crearon cuentas, no se modificaron datos y no se completó una sesión real en Google/GitLab. Las mediciones de contraste son muestras de Chromium, no una auditoría WCAG completa ni una prueba con lector de pantalla.

Comando de navegador desde `frontend`, usando Chromium local:

```powershell
$env:E2E_BASE_URL = 'http://127.0.0.1:3107'
npx.cmd playwright test tests/e2e/landing.spec.ts
```

Se consultaron UI/UX Pro Max, imagegen y Modern Web Guidance (`tabs`, `accessibility`). La selección incorpora un subrayado con borde además del color; se conservan etiquetas visibles, autocomplete y relaciones entre errores y campos. El patrón de teclado funciona sin agregar un polyfill de focusgroup. La documentación instalada de Next.js confirmó el uso de imagen estática con dimensiones intrínsecas y `preload`.
