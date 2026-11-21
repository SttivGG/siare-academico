# H6-7A — Candidato Sorvo para main

Preparación del 21 de noviembre de 2026, America/Bogota. Rama `release/h6-sorvo-consolidation`, creada desde `feat/h6-navigation-appearance` en `2cc4575a5ddc636d61e0020877ba88ddfab2f285`. Base de integración: `origin/main` en `c8f934492f0cc7809282657270df34b4474915ca`.

[PR draft #17 hacia main](https://github.com/SttivGG/siare-academico/pull/17). No se fusionan ni cierran las ramas o PR anteriores.

## Comportamiento incluido

Se conserva la landing definitiva y su logo PNG limpio; el sistema Sorvo; navegación contraída/expandida; cuenta inferior; encabezado compacto; Apariencia con cinco fotografías y Sin imagen, miniaturas y créditos Pexels; temas Claro/Oscuro/Sistema; transparencia, desenfoque y velo. Se conserva el workspace A, Fuentes | Aprendizaje | Estudio, Quiz, Crucigrama, borradores y respuestas por actividad, envío idempotente y recuperación local cifrada opcional.

El inventario vigente tiene **15 rutas y 58 casos**, con cinco manejadores técnicos adicionales. [Matriz de esta preparación](H6_RELEASE_MATRIX.csv). La matriz histórica y las evidencias previas permanecen en `docs/design/`.

## Corrección de origen

El frontend de preview tenía `APP_ORIGIN=http://127.0.0.1:3107`, mientras el core compartido tenía `APP_ORIGIN=http://127.0.0.1:3100`, `GOOGLE_REDIRECT_URI=http://127.0.0.1:3100/api/oidc/callback/google` y su equivalente GitLab. `OidcProviders.callback()` construye y verifica ese callback; el controlador lo coloca en la URL oficial de autorización. `FederatedLogin` entregaba esa URL al navegador tras una comprobación que validaba el proveedor, pero no el callback. El regreso del proveedor podía por tanto llevar a 3100. Se comprobó la configuración activa sin imprimir secretos ni iniciar un flujo externo.

La navegación local anónima y las respuestas 307 a rutas protegidas ya usaban rutas relativas: no se reprodujo un salto en esos recorridos. No se atribuye el problema a un middleware inexistente ni a un reemplazo global de puertos.

Ahora el BFF comprueba que exista un único `redirect_uri`, exactamente igual al callback del proveedor bajo el origen público configurado del frontend. Una discrepancia devuelve 502 `OIDC_REDIRECT_CHANGED`, sin entregar la URL externa ni instalar la cookie del flujo. No se reescribe una URL firmada o registrada por otro entorno. Los callbacks internos, tanto de éxito como de fallo, devuelven `Location` relativo con destinos controlados por la aplicación. Los parámetros `next`, `returnTo` y `callbackUrl` no eligen destinos.

`public-origin.ts` valida la configuración explícita, permite HTTPS y HTTP de loopback, y rechaza credenciales, rutas, query y fragmentos. No infiere orígenes desde `Host` ni `X-Forwarded-Host`. Se retira el fallback fijo a 3100 del BFF, archivos y OIDC; una configuración ausente/inválida rechaza mutaciones. Se conservan CSRF, cookies HttpOnly/SameSite, MFA, contratos del backend y el flujo oficial de cada proveedor.

| Archivo o configuración | Responsabilidad |
| --- | --- |
| Core: `application.properties`, `OidcProviders.java` | `siare.oidc.app-origin`, `APP_ORIGIN`, `GOOGLE_REDIRECT_URI`, `GITLAB_REDIRECT_URI`; origen del callback externo. Sin cambios |
| `frontend/src/components/federated-login.tsx` | Entrega al navegador la URL oficial recibida del BFF. Sin cambios |
| `frontend/src/app/api/oidc/start/route.ts`, `lib/oidc-policy.ts` | Validación nueva del callback exacto antes de entregar la URL externa |
| `frontend/src/app/api/oidc/callback/[provider]/route.ts`, `lib/oidc-server.ts` | `Location` interno relativo, sin construir origen desde headers |
| `frontend/src/lib/public-origin.ts` | Validación central de configuración del operador y destinos internos |
| Rutas BFF/archivos, `session-policy.ts`, `document-policy.ts` | Origen validado y rechazo explícito de configuración vacía, manteniendo CSRF y límites |

## Entrega y límites

Solo se autoriza actualizar la preview 3107. La instalación habitual y sus nueve servicios se preservan; ningún merge ni despliegue en 3100 forma parte de esta entrega. H5 #8/#9 no se integra. No se añaden migraciones ni se activa ML.

[Validación y decisión](H6_RELEASE_CHECKLIST.md), [plan de integración y reversión](H6_INTEGRATION_PLAN.md), [limitaciones](H6_KNOWN_LIMITATIONS.md), [limpieza y privacidad](H6_CLEANUP_SECURITY.md). Los resultados controlados no acreditan OIDC externo, SMTP, roles privilegiados reales ni la seguridad del backend Spring.
