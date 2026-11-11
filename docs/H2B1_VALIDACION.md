# Validación H2-B1

Fecha: 11/11/2026, America/Bogota. Rama `feature/h2b-mfa-recuperacion`.
No se hizo commit ni push. `main` y PR #1 no se modificaron. El árbol ya contenía
trabajo H2-A sin commit; esta validación se refiere al árbol combinado actual.

## Preservación y migración

Se capturaron huellas antes de V3 y se compararon después de aplicarla, antes de
crear datos sintéticos H2-B1. Se conservaron exactamente 86 usuarios, 52 materias,
86 asignaciones de rol/ámbito, 29 sesiones, 37 registros refresh y 57 eventos de
auditoría. Coincidieron también las huellas MongoDB/GridFS, RSA y `.env`.
Evidencia privada local: `.cache/h2b1-continuity-{before,after}.json` y
`.cache/h2b1-identity-{before,after}.json`. El único montaje añadido es el archivo
AES externo, solo lectura; no se sustituyeron montajes persistentes anteriores.

`V3__mfa_and_recovery.sql` añade nivel/fechas MFA a sesiones y crea
`mfa_credentials`, `mfa_challenges`, `mfa_recovery_codes` y
`password_reset_tokens`, con índices y relaciones a usuarios. V1/V2 no se editaron.
Los eventos nuevos usan la tabla de auditoría V2. Los registros antiguos reciben
nivel PASSWORD, nunca MFA por defecto. Una prueba aislada migra V2 a V3 y compara
usuarios, roles, sesiones, refresh y auditoría; una segunda ejecución es idempotente.

La clave AES nueva se provisionó fuera del repositorio y se conservó entre
reconstrucciones/reinicios. No se leyó ni imprimió su contenido. No se borraron
volúmenes, no se cambiaron credenciales existentes ni se regeneró RSA. Las suites
HTTP/navegador añaden cuentas/materias/documentos sintéticos `@example.test`, que
se conservan; no se elimina información para dejar las pruebas "limpias".

## Ejecuciones

| Comprobación | Resultado y evidencia |
| --- | --- |
| Java 21 host | 79 pruebas correctas antes de añadir el caso HTTP final de recuperación; `.cache/h2b1-java-final.log` |
| Java 21, imagen final Docker | 81 pruebas, cero fallos, errores u omisiones; incluye 28 de MFA/recuperación y migración V2→V3; `.cache/h2b1-core-release-final.log` |
| Next.js | 15 unitarias correctas, compilación y TypeScript correctos; `.cache/h2b1-frontend-docker-final.log` |
| Flask, OCR real Docker | 13 pruebas correctas, sin omisiones; `.cache/h2b1-python.log` |
| Express host Node 24 | Tres pruebas y TypeScript correctos; `.cache/h2b1-express-final.log` |
| H2-B1 HTTP / MySQL | 34 comprobaciones correctas y reinicio de MySQL/Spring/Next; `.cache/h2b1-live.log` |
| H2-A HTTP | 43 comprobaciones correctas; `.cache/h2b1-h2a-live.log` |
| Fase 1 HTTP | 31 comprobaciones correctas; `.cache/h2b1-phase1.log` |
| Fase 2 HTTP | 161 comprobaciones correctas, seis formatos y caída/recuperación real de Flask; `.cache/h2b1-phase2.log` |
| Navegador Chrome | Ocho regresiones anteriores correctas en 1440/375 px; los dos casos nuevos MFA fallaron inicialmente por selector ambiguo de prueba, corregido. Los cuatro casos MFA/recuperación pasan al repetir; `.cache/h2b1-browser.log` y `.cache/h2b1-browser-mfa-final.log` |
| Salud final | Nueve saludables tras activar la última imagen, conexiones autenticadas a los cinco motores y BFF comprobados; `.cache/h2b1-health-complete.log` |
| OpenAPI | 36 rutas, 41 operaciones, 347 referencias internas resueltas, operationId únicos |

Las suites HTTP preservan objetos propios/ajenos y las operaciones de materias,
documentos, extracción, descarga, refresh y revocación. La persistencia MFA real
se demuestra con una sesión válida tras reinicio, factor activo y refresh útil;
las sesiones revocadas anteriores siguen dando 401. No se deshabilita el límite
de intentos para probar la composición: las pruebas usan cuentas sintéticas
independientes y respetan los límites reales.

Se revisaron visualmente `.cache/h2b1-security-desktop.png` y
`.cache/h2b1-security-mobile.png`: formularios legibles, foco y etiquetas visibles,
estado de seguridad sin semillas y sin desbordamiento horizontal. El recorrido
web comprueba QR local, confirmación, códigos offline, cookie de desafío HttpOnly,
ausencia de access/refresh antes de MFA, rechazo de reutilización, CSRF y USER sin
administración. No se guardaron capturas del alta con la semilla visible.

## Recursos medidos

No se añadieron servicios Docker ni se ampliaron límites de memoria/CPU. El correo
añade un worker y una cola de 32 trabajos; Argon2 conserva el semáforo H2-A de dos
operaciones. Los builds Docker se ejecutaron secuencialmente por servicio. La
resultado de la imagen final Spring se registra en la tabla de ejecuciones.

Muestra `docker stats --no-stream` después del despliegue final, durante las
comprobaciones de navegador, registrada en `.cache/h2b1-resources-final.log`:

| Servicio | Memoria usada / límite |
| --- | --- |
| Spring | 389,1 MiB / 768 MiB |
| Next | 107,9 MiB / 384 MiB |
| Flask | 50,79 MiB / 256 MiB |
| Express | 78,92 MiB / 256 MiB |
| MySQL | 234,2 MiB / 640 MiB |
| Cassandra | 1,23 GiB / 2,5 GiB |
| Redis | 12,44 MiB / 192 MiB |
| ClickHouse | 572,2 MiB / 1 GiB |
| MongoDB | 260,1 MiB / 768 MiB |

Antes del cambio Spring usaba 408,1 MiB y Next 59,45 MiB; son muestras puntuales,
no una comparación de carga equivalente ni una medida de pico. No se realizó
prueba de carga ni se estiman percentiles de producción.

## Matriz de aceptación

| # | Requisito | Evidencia |
| --- | --- | --- |
| 1 | Activación válida | MfaRecoveryTests y QR/confirmación reales en web |
| 2 | TOTP incorrecto | 401, auditoría y estado conservado; HTTP real |
| 3 | TOTP expirado | Reloj inyectable, código de tres pasos atrás rechazado |
| 4 | Reutilización | Paso de activación rechazado en login; HTTP real y prueba aislada |
| 5 | Exceso de intentos | Cinco fallos persistidos; nuevo desafío no evade límite de cuenta |
| 6 | PENDING | Sin factor activo hasta demostrar posesión, caducidad de diez minutos |
| 7 | ADMIN sin MFA | Solo desafío, sin tokens ni sesión; bearer de desafío rechazado |
| 8 | SUPERADMIN sin MFA | Alta provisional sin permisos ni refresh; cadena Spring real en pruebas |
| 9 | ADMIN válido | API real MockMvc con sesión MFA: lista ámbito y deshabilita USER propio |
| 10 | Otro ámbito | Escritura prohibida; RBAC H2-A conservado |
| 11 | USER sin elevación | MFA no concede administración: API, MySQL HTTP y navegador |
| 12 | Recuperación válida | Contraseña + desafío + código offline; consume uno y revoca sesiones |
| 13 | Recuperación reutilizada | 401 y un único ganador concurrente; API y navegador |
| 14 | Pérdida/reemplazo | Contraseña + factor; anterior activo hasta confirmar nuevo; regeneración invalida códigos y sesiones |
| 15 | Solicitud de contraseña | 202 genérico y captura efímera de correo en pruebas |
| 16 | Token inválido/expirado/usado | Reloj y consumo atómico; token reutilizado rechazado por endpoint público |
| 17 | Cambio y revocación | Argon2id nuevo, sesiones/desafíos revocados, MFA activo conservado, notificación capturada |
| 18 | Enumeración | Igual cuerpo y 202 para existente/inexistente/limitada; lookup y SMTP fuera de respuesta pública |
| 19 | Concurrencia MFA | Dos hilos en activación, TOTP y recuperación: un único ganador |
| 20 | Auditoría | Altas, verificaciones, fallos, recuperación, regeneración y restablecimiento; sin semillas/tokens en recursos |
| 21 | Reinicio | MySQL/Spring/Next con factor y sesión persistentes; RSA conservada |
| 22 | Argon2id/BCrypt | Regresiones H2-A: rehash compatible y política compartida con recuperación |
| 23 | Regresiones H2-A | Suite Java y 43 verificaciones HTTP |
| 24 | Fases 1/2 | Java, Flask, Express, 31+161 verificaciones HTTP y navegador |
| 25 | Nueve servicios | Test-Siare comprueba salud, cinco motores autenticados, BFF y aislamiento de puertos |

Las pruebas administrativas positivas usan credenciales sintéticas de H2 aislado
y recorren JWT/MockMvc/RBAC reales. No se creó un administrador público ni se
elevó una cuenta real para validarlas. La prueba publicada RFC 6238 Appendix B
no es una semilla desplegada. Las claves de prueba son efímeras, generadas al
arrancar el perfil test; no existe bypass en producción.

## Problemas corregidos

- MySQL TIMESTAMP(6) podía redondear la verificación al futuro respecto de un
  reloj fijo. Se trunca a microsegundos antes de crear sesiones MFA.
- Refresh obtiene primero una referencia sin lock y después bloquea usuario,
  sesión y refresh, evitando invertir el orden frente a cambios MFA concurrentes.
- El BFF reconoce desafíos sin access/refresh y convierte las confirmaciones
  MFA en cookies, sin serializar las sesiones anidadas al navegador.
- Se invalidan semillas pendientes y desafíos al cambiar contraseña; el factor
  activo se conserva. Los fallos MFA confirman contadores/auditoría antes del 401.
- El presupuesto de restablecimiento se separa por token/cuenta, conservando el
  techo global: fallos de un token no bloquean la recuperación de otra cuenta.
- JSON `null` o arrays se rechazan como 400 en BFF, antes de inyectar el desafío.
- El fragmento de recuperación se consume una sola vez también bajo StrictMode
  de desarrollo; se elimina de la URL sin perder el token en memoria.
- El selector Playwright distinguía incorrectamente el aviso de error del
  anunciador de rutas Next.js. Se acota por contenido sin cambiar el producto.
- Express runtime omite dependencias de desarrollo: `npm test` allí no encuentra
  tsc. Sus pruebas/compilación se ejecutaron correctamente en el checkout host.

## Límites y trabajo pendiente

La entrega real de correo queda **pendiente**, por decisión expresa del usuario:
no dispone de servidor SMTP ni credenciales. Se preparó el adaptador SMTP
configurable, pero las pruebas solo acreditan generación, expiración, uso único,
no exposición pública, cambio de contraseña, notificación capturada y revocación.
No se declara recuperación por correo de extremo a extremo en esta instancia.

La cola de correo es acotada y no duradera: un cierre antes del envío requiere
solicitar otro enlace. No se ha ensayado pérdida total de factores con responsables
institucionales ni restauración de un respaldo cifrado de clave en otro equipo;
el procedimiento controlado está documentado. No se ejecutó el bootstrap TTY con
una cuenta privilegiada real. No se acredita carga sostenida, TLS público,
auditoría inmutable frente al DBA ni rotación automática de la clave AES.
OIDC y móvil permanecen fuera de alcance.

## Inventario de cambios H2-B1

Los siguientes grupos describen los archivos añadidos o ampliados por H2-B1;
`git status` incluye además los cambios H2-A que ya existían al comenzar.

- Raíz/documentación: `.env.example`, `compose.apps.yml`, `README.md`,
  `docs/ARCHITECTURE.md`, `docs/PLAN_ENTREGA_2026_2.md`, `docs/openapi.json`,
  `docs/H2B1_MFA_RECUPERACION.md` y este documento.
- Frontend: `package.json`, `package-lock.json`, `next.config.ts`,
  `src/app/globals.css`, rutas `seguridad`, `login/mfa`, `recuperar` y
  `recuperar/confirmar`, `src/app/api/bff/[...path]/route.ts`,
  `src/app/(student)/administracion/page.tsx`, componentes `auth-form`,
  `student-nav`, `mfa-panel`, `password-recovery-form`, bibliotecas `api`,
  `server-session`, `session-policy` y `tests/e2e/mfa.spec.ts`.
- Scripts: `Initialize-H2B1.ps1`, `Get-H2B1Continuity.ps1`, `Test-H2B1.ps1`,
  `test-h2b1.mjs`.
- Core: `pom.xml`, migración V3; seis puertos MFA/reset de entrada; puertos de
  salida `MfaRepository`, `TotpPort`, `PasswordResetRepository`, `SecurityMailPort`,
  `SessionRepository`, `TokenPort`, `PrivilegedAccessPolicy`; modelos
  `MfaCredential`, `UserSession`; servicios `MfaService`, `PasswordResetService`,
  `AccountService`, `SessionService`, `AdministrationService`.
- Adaptadores/configuración: `RecoveryController`, `JdbcRecoveryAdapter`,
  `JdbcIdentityAdapter`, `AesTotpAdapter`, `SessionMfaPolicy`, `SmtpSecurityMail`,
  `BusinessConfiguration`, `SecurityConfiguration`, `IdentityMaintenance`,
  `SuperadminBootstrap`.
- Pruebas Java: `MfaRecoveryTests`, `IdentityMigrationTests`, `IdentityApiTests`,
  `TestKeysConfiguration`.

Los endpoints, flujos, límites, cifrado, respaldo y recuperación administrativa
se detallan en [H2B1_MFA_RECUPERACION.md](H2B1_MFA_RECUPERACION.md).
