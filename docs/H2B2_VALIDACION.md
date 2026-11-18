# Validación H2-B2

## Estado vigente tras el cambio de alcance

Google conserva su configuración y el login/alta reales confirmados por el usuario
el 11/11/2026: [diagnóstico y confirmación](H2B2_GOOGLE_DIAGNOSTICO.md).
GitLab.com sustituye a Microsoft Entra; Microsoft queda descartado, sin
modificar migraciones ni eliminar identidades o sesiones existentes.
Configuración y callback: [H2B2_OIDC.md](H2B2_OIDC.md). Las pruebas de esta
sustitución se registran en [H2B2_GITLAB_VALIDACION.md](H2B2_GITLAB_VALIDACION.md).
GitLab ya tiene configuración local y arranque del flujo documentados en
[H2B2_GITLAB_REAL.md](H2B2_GITLAB_REAL.md); el canje y los recorridos completos
reales siguen pendientes. El estado de esta consolidación se registra en
[CONSOLIDACION_MAIN.md](CONSOLIDACION_MAIN.md).

## Evidencia histórica de la entrega inicial

Los resultados y pendientes siguientes describen la entrega inicial anterior
a la confirmación real de Google y a la sustitución de Microsoft. No son el
estado vigente de los proveedores.

Este documento conserva la validación de la entrega inicial. El diagnóstico
posterior con Google habilitado, la causa observada y la corrección del reloj
se documentan en [H2B2_GOOGLE_DIAGNOSTICO.md](H2B2_GOOGLE_DIAGNOSTICO.md).

Fecha: 11/11/2026, America/Bogota. Rama `feature/h2b2-oidc`.
El árbol inicial estaba limpio. No se hizo commit, push ni merge.

## Preservación

V4 se aplicó con Flyway al activar las imágenes verificadas. Las huellas antes
y después coinciden exactamente: 105 usuarios, 59 materias, 105 asignaciones de
acceso/ámbito, 66 sesiones, 81 registros refresh y 162 eventos de auditoría.
Coinciden también todas las colecciones documentales/GridFS, claves RSA,
montajes persistentes y `.env`. Evidencia local privada:
`.cache/h2b2-{identity,continuity}-{before,after}.json`.

V1/V2/V3 permanecen intactas. No se borraron volúmenes, usuarios ni documentos,
ni se cambiaron claves o contraseñas. Las pruebas posteriores añaden cuentas,
sesiones e identidades sintéticas `@example.test`, que se conservan.

## Ejecuciones

| Comprobación | Resultado y evidencia |
| --- | --- |
| Java 21, host | 107 pruebas, cero fallos/errores/omisiones; `.cache/h2b2-java-final.log` |
| Java 21, imagen Spring | 107 pruebas correctas, incluida la suite OIDC; `.cache/h2b2-core-docker.log` |
| OIDC aislado | 25 pruebas de federación y una de migración V3→V4; incluidas en las 107 |
| Frontend | 18 unitarias, build y TypeScript correctos; `.cache/h2b2-frontend-docker-final.log` |
| BFF compilado | Cuatro pruebas HTTP contra Next real y upstream controlado; `.cache/h2b2-bff-integration.log` |
| Flask y Express | 13 pruebas Python con OCR real, sin omisiones, y tres de Express/TypeScript; `.cache/h2b2-python-final.log`, `.cache/h2b2-express.log` |
| OpenAPI | 42 rutas, 47 operationId únicos y 403 referencias internas resueltas |
| OIDC con MySQL/Redis reales y reinicio | Una prueba de adaptadores/protocolo y 17 comprobaciones HTTP correctas; `.cache/h2b2-live-final.log` |
| Regresiones HTTP | H2-B1: 34 (con reinicio MFA), H2-A: 43, Fase 1: 31 y Fase 2: 156 (caída/recuperación Flask); `.cache/h2b2-{h2b1-live,h2a-live,phase1,phase2}.log` |
| Navegador, escritorio/móvil | 12 regresiones previas y dos OIDC correctas; `.cache/h2b2-browser.log` y `.cache/h2b2-browser-oidc-final.log` |
| Nueve servicios y cinco motores autenticados | Todos saludables; consultas autenticadas y puertos loopback verificados tras el último frontend; `.cache/h2b2-health-final.log` |

Las pruebas ordinarias usan H2 aislado; no se presentan como prueba MySQL.
`ControlledOidcProvider` expone discovery, token y JWKS en loopback, genera claves
RSA propias y comprueba verifier PKCE, redirect, client_id y secreto de prueba.
Entrega ID tokens firmados válidos y variantes deliberadamente incorrectas.
La suite combina recorridos de protocolo por la cadena Spring real, su proveedor OIDC y MockMvc con pruebas directas de aplicación y configuración. El almacenamiento efímero se sustituye por memoria solo en esa suite.

La prueba `OidcRealStoresTests`, etiquetada `real-stores`, se excluye de la suite
ordinaria. `Test-H2B2.ps1` la ejecuta explícitamente en la red de datos Docker con
MySQL y Redis auténticos y el mismo proveedor OIDC controlado. Precarga las
dependencias en una imagen de pruebas y usa Maven offline dentro de la red
interna. Verifica TTL y GETDEL concurrente en el adaptador Redis de producción,
persistencia MySQL, logins concurrentes y emisión de una sesión SIARE. Conserva
solo refresh opaco y UUID de sesión/usuario de esa cuenta sintética en un archivo ignorado bajo
`.cache`, sin imprimirlas. El script reinició MySQL/Spring/Next y luego pudo
comprobar acceso, refresh, logout y revocación por HTTP. Los JWT del perfil test usan una clave aislada; tras reinicio se canjea el refresh MySQL para recibir el JWT de producción, conservando el sessionId.

El BFF se prueba además con el servidor Next compilado, en puertos efímeros
locales y un upstream controlado. Comprueba Origin/CSRF, lista de campos,
ausencia de contexto, cookies HttpOnly, refresh Strict, desafío MFA sin sesión,
redirects fijos y vinculación solo con confirmación y sesión original. Estas
respuestas controladas no acreditan autenticación real de Google/Microsoft.

## Matriz de aceptación

| # | Requisito | Evidencia |
| --- | --- | --- |
| 1 | Google válido | Discovery, PKCE, token y JWKS controlados, sesión USER |
| 2 | Microsoft válido | Proveedor controlado, issuer/tenant y cuenta técnica sin correo de recuperación no verificado |
| 3 | State incorrecto | Rechazo antes del intercambio; también contexto de navegador incorrecto |
| 4 | Nonce incorrecto | ID token firmado rechazado por Spring |
| 5 | Firma inválida | Mismo kid, clave privada ajena; rechazo JWKS |
| 6 | Issuer inválido | Token firmado con issuer ajeno rechazado |
| 7 | Audience inválida | client_id ajeno rechazado |
| 8 | Expirado | exp vencido, tolerancia cero |
| 9 | Replay | State consumido en éxitos y fallos; GETDEL de producción probado por separado |
| 10 | Redirect no permitido | Campo no reconocido y callback alterado rechazados; BFF limita host HTTPS del proveedor |
| 11 | Nuevo USER | Rol de MySQL USER, marcador sin contraseña y API administrativa prohibida |
| 12 | Correo local coincidente | 409; sin identidad ni fusión automática |
| 13 | Vinculación legítima | Confirmación, sesión reciente, callback, UUID conservado y auditoría |
| 14 | Duplicación/concurrencia | Un ganador entre dos propietarios; logins simultáneos sin usuarios duplicados |
| 15 | Desvinculación | Última vía bloqueada, contraseña u otro proveedor habilitado requeridos; otras sesiones revocadas |
| 16 | ADMIN sin MFA | ADMIN/SUPERADMIN reciben desafío sin access/refresh; API bloqueada |
| 17 | ADMIN con MFA | TOTP SIARE confirmado, sesión MFA y API administrativa autorizada según rol/ámbito |
| 18 | Tokens externos | ID token firmado del proveedor y access token externos reciben 401 en SIARE |
| 19 | Logout/revocación | Refresh/sesión propios; revocados reciben 401 |
| 20 | Reinicio | MySQL/Spring/Next reiniciados: refresh persistido recupera la misma sesión y acceso, luego logout/revocación efectivos |
| 21 | No configurado | Credenciales incompletas desactivan cada proveedor; tenant genérico rechazado |
| 22 | Comunicación | Token endpoint devuelve 503: no se emite sesión; error sanitizado y nuevo flujo requerido |
| 23 | H2-A/H2-B1 | 81 regresiones Java previas; HTTP H2-A 43 y H2-B1 34, incluido MFA después de reiniciar |
| 24 | Materias/documentos | Java, 31 HTTP Fase 1, 156 HTTP Fase 2 y navegador desktop/mobile correctos; caída/recuperación Flask real |
| 25 | Nueve saludables | Test-Siare final: nueve healthy, cinco motores autenticados, Flask/Express y BFF comprobados |

La nueva prueba de navegador tuvo inicialmente un selector ambiguo entre el aviso de error y el anunciador interno de Next. Se filtró por el contenido del aviso y se repitieron ambos tamaños correctamente; las 12 regresiones restantes ya habían pasado. La comprobación SQL de Fase 1 se amplió para admitir `!OIDC` exclusivamente cuando existe una identidad externa del usuario; conserva la detección de hashes no admitidos.

Adicionalmente se prueban RS512 no autorizado, `tid` inconsistente, Google sin
correo verificado, registro cerrado, usuario deshabilitado, sesión revocada o
antigua al vincular, y configuración MFA de una cuenta sin contraseña local.
Las cuentas locales siguen necesitando contraseña para gestionar MFA.

Se revisaron visualmente las capturas `.cache/h2b2-login-{desktop,mobile}.png`: diseño provisional conservado, botones secundarios coherentes con la interfaz, mensajes legibles y ausencia de desbordamiento a 1440/375 px. Las capturas de Seguridad generadas por las regresiones MFA también conservan las opciones locales y el panel de identidades.

## Recursos

Muestra puntual después de las regresiones y del último despliegue frontend; no es una prueba de carga ni una medida de pico. No se ampliaron límites ni se añadieron servicios permanentes. Evidencia: `.cache/h2b2-resources-final.log`.

| Servicio | Memoria usada / límite |
| --- | --- |
| Spring | 482,6 MiB / 768 MiB |
| Next | 67,18 MiB / 384 MiB |
| Flask | 57,13 MiB / 256 MiB |
| Express | 92,68 MiB / 256 MiB |
| MySQL | 236,4 MiB / 640 MiB |
| Cassandra | 1,194 GiB / 2,5 GiB |
| Redis | 16,44 MiB / 192 MiB |
| ClickHouse | 697,8 MiB / 1 GiB |
| MongoDB | 210,9 MiB / 768 MiB |

## Reproducir

En `services/core-api/siare-core`, con Java 21: `mvn verify`. En `frontend`:
`npm test`, `npm run build`, `npm run typecheck`, y después
`node --test tests/integration/oidc-bff.mjs`.

Con la composición actualizada, ejecutar
`./scripts/Test-H2B2.ps1 -RestartContainers`, las suites H2-A/H2-B1/Fases 1/2
existentes y Playwright. No ejecutar suites HTTP simultáneamente: comparten los
límites reales de autenticación. Las imágenes y los tests de protocolo no
requieren secretos Google/Microsoft. Configuración y callbacks:
[H2B2_OIDC.md](H2B2_OIDC.md).

## Integraciones externas pendientes

**Google real: pendiente.** No existe cliente registrado ni client_id/secret
aportado. Faltan consentimiento/usuarios de prueba, registro del callback exacto
y recorrido real de login/vinculación/MFA/logout en navegador.

**Microsoft real: pendiente.** Faltan registro Entra de un tenant, tenant UUID,
client_id, valor del secreto, callback Web y políticas/consentimiento del tenant.
Se debe comprobar con una cuenta organizacional admitida y otra fuera del tenant.

Los proveedores permanecen desactivados en la configuración actual. No se
afirma que funcionen en producción. No se hizo ninguna petición de autenticación
real a ellos; las claves y tokens usados por las pruebas son del proveedor
controlado. El control de red, consentimiento y registro de las aplicaciones
externas no puede concluirse sin esas credenciales y acceso administrativo.

**SMTP real: pendiente anterior de H2-B1.** Las capturas de correo en pruebas
validan tokens y contenido, no entrega real. React Native/APK también sigue
pendiente; esta entrega documenta su contrato recomendado sin implementarlo.
