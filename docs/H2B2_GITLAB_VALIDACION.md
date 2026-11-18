# H2-B2: sustitución de Microsoft por GitLab.com

Fecha: 11/11/2026, America/Bogota. Se conserva el trabajo previo de H2-B2 sin
commit ni push. Microsoft Entra queda fuera del alcance por falta de
suscripción/configuración de facturación para registrar la aplicación.

Actualización posterior: el usuario registró la aplicación y aportó las
credenciales localmente. GitLab ya está habilitado en Spring/Next y el inicio
con discovery real pasó las comprobaciones. El login completo sigue pendiente
de autenticación del usuario. Evidencia y recorridos:
[H2B2_GITLAB_REAL.md](H2B2_GITLAB_REAL.md). Los apartados de configuración
pendiente de abajo describen la sustitución inicial.

## Implementación

Los proveedores activos del contrato son `google` y `gitlab`. Configuración,
DTOs, BFF, registro, login, vinculación y OpenAPI usan ese par. Los antiguos
valores de Microsoft se rechazan al iniciar/completar OIDC, sin convertir ni
eliminar identidades históricas. La UI identifica cualquier proveedor retirado
con una etiqueta genérica y conserva la desconexión explícita.

GitLab.com usa discovery `https://gitlab.com/.well-known/openid-configuration`,
issuer fijo `https://gitlab.com`, Authorization Code con PKCE S256, scopes
`openid email profile` y autenticación confidencial `client_secret_post`.
El discovery público y la documentación oficial se consultaron para comprobar
estas capacidades. No se admiten emisores Self-Managed ni se solicitan permisos
de API, repositorios o acceso offline.

Se conservan JWKS/RS256, issuer/audience/azp, state consumible una sola vez,
nonce y expiración estricta. El margen de emisión de 60 segundos conserva la
corrección de Google; no extiende `exp`. Las cuentas se resuelven por
`issuer + subject`, nunca por email. Las nuevas son USER y reutilizan sesiones
SIARE revocables. ADMIN/SUPERADMIN completan el MFA SIARE antes de recibir
access/refresh. Vincular exige confirmación y la misma sesión reciente.

Google mantiene configuración y comportamiento. Su login y alta reales
confirmados por el usuario siguen documentados en
[H2B2_GOOGLE_DIAGNOSTICO.md](H2B2_GOOGLE_DIAGNOSTICO.md), sin alterar ese archivo.
GitLab solo utiliza como contacto un correo válido con `email_verified=true`;
si falta o no está verificado usa una dirección técnica sin recuperación por
correo. Un correo coincidente exige vinculación explícita.

## Pruebas

| Comprobación | Resultado |
| --- | --- |
| Java 21, imagen Spring | 135 pruebas correctas, 53 de federación y una de migración incluidas |
| Frontend, imagen Next | 19 unitarias, build y TypeScript correctos |
| BFF compilado aislado sin red externa | Seis pruebas correctas con upstream de loopback |
| OpenAPI | 42 rutas, 47 operationId únicos y 403 referencias resueltas |
| MySQL/Redis reales | Dos pruebas correctas, una por proveedor, con discovery/token/JWKS controlados |
| Reinicio y HTTP H2-B2 | 24 comprobaciones correctas tras reiniciar MySQL/Spring/Next: refresh de la misma sesión, logout y revocación |
| Salud y conexiones | Nueve servicios healthy, cinco motores autenticados, Flask/Express y BFF verificados |
| Regresiones HTTP | H2-B1: 30; H2-A: 43; Fase 1: 31, todas correctas |
| Navegador, escritorio/móvil | Seis recorridos correctos sobre el frontend final: Google/GitLab, ausencia de Microsoft, CSRF/callback, conflictos y errores accesibles |
| Google efectivo | Cinco variables coinciden con Compose resuelto; Google habilitado e inicio/discovery real desde BFF correcto, con PKCE y callback original |

La suite de federación mantiene las regresiones Google y amplía a GitLab los
rechazos criptográficos, state/replay, scopes mínimos, vinculación y MFA de
ambos roles administrativos. Comprueba también correo GitLab ausente/no
verificado, separación del mismo subject por issuer, estabilidad ante cambio
de correo y conservación de una identidad histórica de Microsoft.

Las claves, secretos y tokens del proveedor controlado son fixtures de prueba;
no se presentan como credenciales o autenticaciones reales de GitLab.com.

Evidencia local ignorada: `.cache/h2b2-gitlab-core-build.log`,
`.cache/h2b2-gitlab-frontend-build-final.log` y `.cache/h2b2-gitlab-bff.log`.
MySQL/Redis, reinicio y HTTP: `.cache/h2b2-gitlab-live.log`.
Regresiones: `.cache/h2b2-gitlab-{h2b1,h2a,phase1}.log`.
Navegador y estado final: `.cache/h2b2-gitlab-browser-final.log` y
`.cache/h2b2-gitlab-final.log`. Se revisaron las capturas de registro a
1440 y 375 px: ambos botones legibles, sin Microsoft ni desbordamiento.
La disponibilidad y los fallos externos del navegador se controlan en las
pruebas; no implican credenciales GitLab reales.

Playwright esperaba una versión de Chromium no instalada; se utilizó Chrome
existente mediante `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, sin descargar otro
navegador. Los seis recorridos se repitieron correctamente tras el último
ajuste del texto de registro. La comprobación de Google inicia el flujo real
sin completar otra autenticación: la confirmación previa de login/alta reales
se conserva con su alcance original.

Para reproducir: construir `core-api` y `frontend` con los Compose de la
instancia, ejecutar `scripts/Test-H2B2.ps1 -RestartContainers`,
`scripts/Test-H2B1.ps1`, `scripts/Test-H2A.ps1` y `scripts/Test-Phase1.ps1`
secuencialmente. En `frontend`, ejecutar
`node node_modules/@playwright/test/cli.js test tests/e2e/oidc.spec.ts`
con `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` apuntando al Chrome instalado.

## Conservación de la instalación

Antes de activar las nuevas imágenes y justo después se compararon huellas de
usuarios/materias, documentos Mongo/GridFS/texto, identidades externas, roles,
ámbitos, sesiones, refresh, auditoría, claves RSA, montajes y `.env`: coincidencia
exacta. Las cuatro migraciones V1/V2/V3/V4 conservan su SHA-256. No se añadieron
servicios, borraron volúmenes ni cambiaron claves o contraseñas.

Las suites reales añaden cuentas e identidades sintéticas `@example.test`,
sesiones y auditoría para probar los adaptadores; esos datos se conservan.
Las huellas privadas están en `.cache/h2b2-gitlab-{continuity,identity}-{before,activated}.json`
y `.cache/h2b2-gitlab-external-before.json`. No contienen credenciales externas.

## Registro externo pendiente en esta validación histórica

Este apartado conserva el estado anterior a la activación local posterior.
El registro de GitLab y la configuración local ya se documentaron en
[H2B2_GITLAB_REAL.md](H2B2_GITLAB_REAL.md); el recorrido completo real sigue
pendiente. No debe interpretarse este apartado como estado actual de `.env`.

La URI exacta de desarrollo que recibe Next es:

```text
http://127.0.0.1:3100/api/oidc/callback/gitlab
```

Crear una aplicación confidencial en GitLab.com con esa Redirect URI y los
tres scopes. Después aportar `GITLAB_CLIENT_ID` y `GITLAB_CLIENT_SECRET`
externamente y activar `GITLAB_OIDC_ENABLED=true`. No se han inventado
credenciales ni modificado el `.env` real. GitLab permanece deshabilitado
hasta esa configuración. Las pruebas controladas no acreditan un login real
con GitLab.com; ese recorrido sigue pendiente. Instrucciones y referencias:
[H2B2_OIDC.md](H2B2_OIDC.md).
