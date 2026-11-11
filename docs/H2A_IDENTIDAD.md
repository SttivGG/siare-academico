# H2-A: identidad, ámbitos y sesiones

Fecha: 10/11/2026. Rama: `feature/h2a-roles-sesiones`, sobre `56fb996`, el mismo commit de `feature/adecuacion-instructivo`. Se conservan Fases 1/2, nueve servicios y ambos Compose. No se hacen commits, push ni fusión del PR #1.

## Roles

| Rol | Permisos preparados | Límites |
| --- | --- | --- |
| USER | Perfil, sesiones, materias y documentos propios | Sin acceso administrativo ni modificación de roles/ámbitos |
| ADMIN | Listar asignaciones y habilitar/deshabilitar USER de su ámbito | No cambia roles ni traslada usuarios; no modifica ADMIN/SUPERADMIN ni otros ámbitos; no consulta auditoría |
| SUPERADMIN | Crear ámbitos, asignar ADMIN/USER y ámbito, habilitar cuentas, consultar auditoría, abrir/cerrar registro público | No asigna SUPERADMIN por HTTP, no modifica SUPERADMIN ni su propia asignación; no elimina auditoría |

En H2-A, `PrivilegedAccessPolicy` devuelve `false` de forma incondicional. No hay variable de entorno que habilite privilegios. ADMIN/SUPERADMIN reciben `403 MFA_REQUIRED` en el login local; sus sesiones tampoco pasan la validación de API ni la renovación. Las pruebas ejercitan las reglas con una política creada únicamente dentro del test, sin instalarla en Spring.

Las APIs consultan rol, ámbito y habilitación en MySQL. Actor y sesión proceden del `sub` y `sid` firmados. Los IDs del cuerpo solo identifican el destinatario de una operación. El registro público rechaza campos desconocidos, incluidos `role`, `roleId`, `scopeId` y `userId`.

El ámbito inicial `Comunidad SIARE`, UUID `00000000-0000-0000-0000-000000000001`, representa la comunidad general de la instalación. SUPERADMIN podrá crear ámbitos reales adicionales cuando disponga de MFA. Los privilegios administrativos no permiten consultar materias o documentos privados ajenos.

## Migración

`V1__users_and_subjects.sql` permanece intacta. Flyway añade `V2__identity_sessions_audit.sql`:

| Tabla/cambio | Propósito |
| --- | --- |
| `users.password_hash VARCHAR(255)` | BCrypt previo y Argon2id; no recalcula credenciales durante la migración |
| `roles`, `administrative_scopes`, `user_access` | Tres roles, asignación única, ámbito, habilitación y versión optimista |
| `user_sessions` | Propietario, actividad, caducidad por inactividad/absoluta, revocación y versión |
| `refresh_tokens` | SHA-256 del secreto, sesión, creación y consumo; historial para detectar reutilización |
| `audit_events` | Actor UUID, operación, recurso, fecha UTC, resultado y ámbito opcional |
| `login_attempts` | Contadores duraderos por identificador derivado y contador global |
| `identity_control` | Exclusión y marca duradera del bootstrap inicial |
| `identity_parameters` | `public_registration_enabled`, booleano con versión |

Los usuarios existentes reciben USER y el ámbito inicial. Se conservan UUID, correo UNIQUE, fecha, hash, materias y relaciones. MongoDB y RSA no cambian. Hibernate mantiene `ddl-auto=validate`.

Los JWT anteriores quedan invalidados aunque aún no hayan caducado: carecen de `sid` y `jti` exigidos por el nuevo contrato. El usuario inicia sesión con sus credenciales anteriores.

## Contraseñas

Las contraseñas nuevas tienen entre 15 y 1024 puntos de código después de NFC, con máximo de 4096 bytes UTF-8. Se permiten espacios, Unicode y frases largas, sin mezcla obligatoria de clases de caracteres. El adaptador comprueba 10.001 huellas de contraseñas comunes y ejemplos largos adicionales. La procedencia y licencia MIT están en `src/main/resources/security/README.md` y `SecLists-LICENSE.txt`.

El corpus no cubre todas las filtraciones. Puede ampliarse mediante `siare.password.blocklist-file`, con SHA-256 de NFC/minúsculas/UTF-8 por línea. Una ruta configurada ilegible o con huellas inválidas impide arrancar. Las contraseñas no se envían a terceros.

`LocalPasswordAdapter` genera Argon2id v19, sal de 16 bytes y salida de 32 bytes. Valores iniciales: `m=19456 KiB`, `t=2`, `p=1`; semáforo de dos operaciones simultáneas. Admite 19456–65536 KiB, 2–6 iteraciones y paralelismo 1–4. La saturación responde 429 sin cola ilimitada.

BCrypt se verifica con la entrada original y el límite previo de 72 bytes. Un login válido sustituye el hash por Argon2id en una transacción, conservando UUID y relaciones. La política nueva no se aplica al login de cuentas existentes. No se truncan contraseñas.

El límite inicial es cinco intentos por correo normalizado en quince minutos y 120 globales por minuto. Se cuentan también intentos válidos para acotar trabajo criptográfico. El registro tiene un contador por correo separado y comparte el global. MySQL conserva los límites tras reinicios; las claves de contador son SHA-256 y no contienen el correo en claro.

## Sesiones y concurrencia

El access sigue usando RS256 y las claves existentes. Incluye `sub`, `sid`, `jti`, `iss`, `iat` y `exp`. Dura cinco minutos por defecto, hasta quince configurables. El refresh contiene 32 bytes de `SecureRandom`, Base64URL sin padding; solo se persiste SHA-256.

Cada renovación consume el refresh y crea otro. Reutilizar uno consumido revoca la sesión completa y registra `REFRESH_REUSE`. La transacción confirma la revocación antes de devolver 401. Las lecturas `FOR UPDATE` del refresh, asignación y sesión consultan el último estado incluso con `REPEATABLE READ` de MySQL. Dos renovaciones del mismo secreto producen como máximo un 200; la segunda revoca también el sucesor. No hay ventana de gracia.

Cada API protegida consulta MySQL después de validar firma, emisor y tiempo. Revocar una sesión invalida su JWT aunque no haya vencido. La actividad autenticada actualiza el plazo de inactividad, limitado por la caducidad absoluta. Un access expirado no prolonga la sesión.

Valores iniciales: 30 minutos de inactividad, siete días absolutos y cinco sesiones activas por usuario. Abrir otra revoca una de las más antiguas. La configuración exige al menos un minuto de inactividad, hasta treinta días absolutos y entre una y veinte sesiones. Cambiar rol, ámbito o habilitación revoca todas las sesiones del destinatario en la misma transacción.

Cada hora se retiran sesiones cuya caducidad absoluta terminó hace más de treinta días, sus refresh por FK y contadores de intentos de más de un día. La tarea conserva usuarios, materias, documentos y toda la auditoría. MySQL es la fuente de verdad; ninguna credencial revocable depende exclusivamente de Redis.

## Arquitectura

`domain/identity` contiene modelos Java puros: `Role`, `AdministrativeScope`, `UserAccess`, `UserSession`, `AuditEvent`, `IdentityParameter` y `PasswordPolicy`. Dominio y aplicación no importan Spring, JPA ni Redis.

`AccountService`, `SessionService` y `AdministrationService` usan puertos de persistencia, contraseña, cribado, tokens, transacciones, auditoría y acceso privilegiado. Los casos de asignación, administración, renovación, revocación, logout y consulta de auditoría tienen interfaces de entrada. Los adaptadores JDBC/criptográficos, configuraciones y controladores permanecen en infraestructura.

## API

El [OpenAPI inicial](openapi.json) describe cuerpos, esquemas, parámetros y errores de los endpoints implementados de Fases 1/2 y H2-A. La API usa `Authorization: Bearer`; el BFF es la frontera de cookies.

| Método | Ruta bajo `/api/v1` | Autorización/comportamiento |
| --- | --- | --- |
| POST | `/auth/register` | Pública; USER; 201; roles enviados producen 400 |
| POST | `/auth/login` | Pública; emite access/refresh; privilegios bloqueados |
| POST | `/auth/refresh` | El refresh es la credencial; rotación y validación persistida |
| POST | `/auth/logout` | Revoca sesión autenticada |
| GET | `/users/me` | Perfil propio sin hash |
| GET | `/users/me/identity` | Rol, ámbito, habilitación y versión propios |
| GET | `/users/me/sessions` | Sesiones propias activas sin tokens |
| DELETE | `/users/me/sessions/{id}` | Solo propia; ajena responde 404 |
| POST | `/users/me/sessions/revoke-others` | Conserva la sesión autenticada |
| POST | `/users/me/sessions/revoke-all` | Incluye la actual |
| GET | `/admin/overview` | ADMIN de su ámbito o SUPERADMIN |
| GET | `/admin/users` | Ámbito propio; SUPERADMIN consulta todos |
| PATCH | `/admin/users/{id}/access` | `{role,scopeId,enabled,version}`; revoca sesiones |
| GET / POST | `/admin/scopes` | ADMIN consulta su ámbito; SUPERADMIN crea con `{name}` |
| GET | `/admin/audit` | Solo SUPERADMIN; paginado |
| GET / PATCH | `/admin/parameters/public-registration` | Solo SUPERADMIN; PATCH `{enabled,version}` |

Todas las rutas administrativas siguen bloqueadas hasta MFA. Los listados usan `limit=50`, `offset=0`, admitiendo limit 1–100 y offset 0–100000. La UI inicial muestra hasta cincuenta asignaciones/eventos.

Los errores conservan `{timestamp,status,code,message,fields}`: 400 por entrada inválida, 401 por credencial/sesión inválida, 403 por permisos/MFA, 404 por ausencia, 409 por duplicados/versión obsoleta y 429 por intentos/capacidad. Documentos conservan 413/415/422 y sus errores de Fase 2. Las respuestas llevan `Cache-Control: no-store`.

## BFF e interfaz

El navegador recibe dos cookies HttpOnly: `siare_session`, SameSite=Lax y caducidad del access; `siare_refresh`, SameSite=Strict y caducidad absoluta. En HTTPS usan Secure y prefijo `__Host-`, Path=/ y sin Domain. El HTTP local conserva `SESSION_COOKIE_SECURE=false`. Los secretos no llegan a localStorage ni componentes cliente.

Las mutaciones JSON exigen origen exacto, JSON y `X-SIARE-CSRF: 1`. La renovación usa exclusivamente la cookie de refresh, ignorando tokens enviados en el cuerpo. Login/renovación devuelven al navegador solo `expiresAt`. El BFF acepta rutas/métodos expresos y reenvía únicamente limit/offset de los listados.

Las cargas multipart conservan el límite configurado. Para devolver 413 sin cerrar prematuramente el socket, el BFF puede consumir hasta 2 MiB de exceso, sin escribirlos ni enviarlos a Spring. El presupuesto de bytes y el timeout de treinta segundos siguen acotando la lectura; un cliente que los excede puede recibir un cierre de transporte.

El cliente comparte la renovación concurrente y usa Web Locks entre pestañas compatibles. Ante 401 de una operación protegida renueva una vez y reintenta. La navegación de servidor deriva a `/sesion/renovar`, que ejecuta un POST con CSRF; no rota credenciales mediante GET. Sin Web Locks solo hay serialización dentro de cada pestaña: renovaciones simultáneas entre pestañas pueden exigir login por la política estricta.

`/sesiones` muestra actividad/caducidad y permite cerrar una, las otras o todas. Logout revoca en backend antes de borrar ambas cookies. `/administracion` comprueba autorización de backend antes de mostrar datos. La navegación usa el rol consultado en servidor. Los paneles iniciales de asignaciones, ámbitos, registro público y auditoría permanecen bloqueados en H2-A. Se conservan las pantallas de materias/documentos.

## Auditoría

Se registran cambios de rol/ámbito/habilitación/parámetro, creación de ámbitos, bootstrap, lecturas administrativas, denegaciones significativas de recursos, revocaciones y reutilización de refresh. La revocación administrativa identifica como actor al administrador. Los eventos usan UTC y UUID y excluyen correos, contraseñas, hashes, tokens y contenido documental.

El puerto expone append/list y no existe API de borrado. Esto protege la frontera administrativa; no acredita inmutabilidad frente al operador de MySQL ni almacenamiento WORM. La tarea de mantenimiento conserva la auditoría.

## Bootstrap

El primer SUPERADMIN se crea mediante un comando con TTY, nombre/correo nuevo y contraseña oculta en consola. No admite la contraseña como argumento o variable de entorno y no promociona una cuenta existente. `identity_control` bloquea ejecuciones concurrentes. Repetirlo termina sin cambios ni nuevas credenciales.

```powershell
docker compose -f compose.datos.yml -f compose.apps.yml run --rm --no-deps --entrypoint java core-api -jar /app/app.jar --siare.bootstrap-superadmin=true
```

Ejecuta el comando en una consola privada, con entrada interactiva y TTY. Si falta `System.console()`, falla sin crear la cuenta. Arranca sin servidor HTTP, confirma cuenta/asignación/auditoría en una transacción y cierra conexiones. La cuenta creada sigue sin acceso privilegiado hasta MFA.

## Migración y operación

```powershell
docker compose -f compose.datos.yml -f compose.apps.yml config --quiet
docker compose -f compose.datos.yml -f compose.apps.yml build core-api
docker compose -f compose.datos.yml -f compose.apps.yml build frontend
./scripts/Get-H2AContinuity.ps1 -OutputPath .cache/h2a-before.json
./scripts/Backup-Siare.ps1
docker compose -f compose.datos.yml -f compose.apps.yml up -d --no-build --wait --wait-timeout 900
./scripts/Get-H2AContinuity.ps1 -OutputPath .cache/h2a-after.json
./scripts/Test-H2A.ps1 -RestartContainers
./scripts/Test-Phase1.ps1
./scripts/Test-Phase2.ps1 -SimulatePythonOutage
```

El respaldo en frío detiene solo esta instancia. Verifica su manifiesto antes del `up` y compara huellas antes de pruebas que creen datos o migren hashes por login. Para recuperar un esquema anterior, restaura el respaldo completo a volúmenes nuevos con el procedimiento existente; no apuntes una imagen anterior a una base parcialmente migrada. La plantilla de recuperación guardada por H1 representa Fase 2 y requiere revisar las imágenes elegidas para recuperar H2-A.

Compose usa `H2A_ACCESS_TTL` para que un `.env` anterior con `JWT_TTL=PT30M` no extienda los access nuevos. `.env.example` documenta opciones H2-A no secretas. Se conservan `.env`, RSA, volúmenes, límites de memoria, dos Compose y red externa.

## Pendientes y fuentes

H2-B debe implementar OIDC, MFA administrativo, recuperación de cuenta y la política privilegiada vinculada a MFA real. La APK corresponde al frente móvil. Quedan por ampliar el corpus según el despliegue y la paginación de la UI administrativa. TLS, secretos administrados y respaldo externo siguen pendientes para producción.

Fuentes: [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html), [contraseñas en Spring Security](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html) y [Bouncy Castle Java](https://www.bouncycastle.org/download/bouncy-castle-java/). Resultados reales: [H2A_VALIDACION.md](H2A_VALIDACION.md).


## Inventario de archivos

Archivos modificados o nuevos respecto al commit base, sin artefactos locales ni secretos:

- `.env.example`
- `compose.apps.yml`
- `docs/ARCHITECTURE.md`
- `docs/H2A_IDENTIDAD.md`
- `docs/H2A_VALIDACION.md`
- `docs/openapi.json`
- `docs/PHASE1.md`
- `docs/PLAN_ENTREGA_2026_2.md`
- `frontend/src/app/(student)/administracion/loading.tsx`
- `frontend/src/app/(student)/administracion/page.tsx`
- `frontend/src/app/(student)/layout.tsx`
- `frontend/src/app/(student)/sesiones/loading.tsx`
- `frontend/src/app/(student)/sesiones/page.tsx`
- `frontend/src/app/api/bff/[...path]/route.ts`
- `frontend/src/app/api/files/[...path]/route.ts`
- `frontend/src/app/globals.css`
- `frontend/src/app/sesion/renovar/page.tsx`
- `frontend/src/components/administration-panel.tsx`
- `frontend/src/components/auth-form.tsx`
- `frontend/src/components/session-renewal.tsx`
- `frontend/src/components/sessions-panel.tsx`
- `frontend/src/components/student-nav.tsx`
- `frontend/src/components/subject-documents.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/document-policy.ts`
- `frontend/src/lib/renew-session.ts`
- `frontend/src/lib/server-session.ts`
- `frontend/src/lib/session-policy.ts`
- `frontend/tests/e2e/identity.spec.ts`
- `frontend/tests/e2e/phase-two.spec.ts`
- `frontend/tests/upload-rejection.test.mjs`
- `README.md`
- `scripts/Get-H2AContinuity.ps1`
- `scripts/test-h2a.mjs`
- `scripts/Test-H2A.ps1`
- `scripts/test-phase1.mjs`
- `scripts/Test-Phase1.ps1`
- `services/core-api/siare-core/pom.xml`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/port/in/AssignRoleUseCase.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/port/in/ListAuditEventsUseCase.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/port/in/LogoutUseCase.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/port/in/ManageAdministratorUseCase.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/port/in/RefreshSessionUseCase.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/port/in/RevokeSessionUseCase.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/port/out/AuditPort.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/port/out/IdentityParameterPort.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/port/out/IdentityRepository.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/port/out/LoginAttemptPort.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/port/out/PasswordPort.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/port/out/PasswordScreeningPort.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/port/out/PrivilegedAccessPolicy.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/port/out/SessionRepository.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/port/out/TokenPort.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/port/out/TransactionPort.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/service/AccountService.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/service/AdministrationService.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/application/service/SessionService.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/domain/account/AccountRules.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/domain/account/BusinessException.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/domain/identity/AdministrativeScope.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/domain/identity/AuditEvent.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/domain/identity/IdentityParameter.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/domain/identity/PasswordPolicy.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/domain/identity/Role.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/domain/identity/UserAccess.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/domain/identity/UserSession.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/infrastructure/adapter/in/web/AccountController.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/infrastructure/adapter/in/web/ApiExceptionHandler.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/infrastructure/adapter/in/web/IdentityController.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/infrastructure/adapter/in/web/PrivateResponseAdvice.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/infrastructure/adapter/out/persistence/JdbcIdentityAdapter.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/infrastructure/adapter/out/persistence/UserEntity.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/infrastructure/adapter/out/persistence/UserPersistenceAdapter.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/infrastructure/adapter/out/security/JdbcLoginAttempts.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/infrastructure/adapter/out/security/LocalPasswordAdapter.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/infrastructure/adapter/out/security/LocalPasswordScreening.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/infrastructure/config/BusinessConfiguration.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/infrastructure/config/IdentityMaintenance.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/infrastructure/config/JwtConfiguration.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/infrastructure/config/SecurityConfiguration.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/infrastructure/config/SuperadminBootstrap.java`
- `services/core-api/siare-core/src/main/java/com/siare/core/SiareCoreApplication.java`
- `services/core-api/siare-core/src/main/resources/application.properties`
- `services/core-api/siare-core/src/main/resources/db/migration/V2__identity_sessions_audit.sql`
- `services/core-api/siare-core/src/main/resources/security/common-passwords.sha256`
- `services/core-api/siare-core/src/main/resources/security/common-passwords.txt`
- `services/core-api/siare-core/src/main/resources/security/README.md`
- `services/core-api/siare-core/src/main/resources/security/SecLists-LICENSE.txt`
- `services/core-api/siare-core/src/test/java/com/siare/core/BootstrapCommandTests.java`
- `services/core-api/siare-core/src/test/java/com/siare/core/DocumentApiTests.java`
- `services/core-api/siare-core/src/test/java/com/siare/core/IdentityApiTests.java`
- `services/core-api/siare-core/src/test/java/com/siare/core/IdentityMigrationTests.java`
- `services/core-api/siare-core/src/test/java/com/siare/core/PasswordPerformanceTests.java`
- `services/core-api/siare-core/src/test/java/com/siare/core/PhaseOneApiTests.java`
