# Contrato de API para React Native

Fuente: controladores Spring, servicios y [OpenAPI 0.4.0](openapi.json). Todas las rutas de las tablas usan el prefijo `/api/v1`, salvo `/health`. En el PC la base local es `http://127.0.0.1:8180`; antes de usar credenciales desde Android resuelve conectividad y TLS según [onboarding](ONBOARDING_MOBILE.md).

## Autenticación directa y alcance pendiente

Spring acepta `Authorization: Bearer <accessToken>`; no acepta las cookies del BFF como autenticación. JSON requiere `Content-Type: application/json`; multipart usa su boundary generado por el cliente. El nativo no necesita las cabeceras CSRF de Next, que protegen exclusivamente las cookies web. No debe llamar a `/api/bff` ni copiar `siare_session`, `siare_refresh` o cookies OIDC.

El contrato actual basta para un cliente nativo de login local, refresh rotatorio, revocación, MFA, roles, materias y documentos sobre HTTPS. Es una conclusión del contrato y sus pruebas backend; todavía no hay pruebas ejecutadas desde React Native. No equivale a un flujo OIDC nativo completo.

Pendientes antes de ofrecer Google/GitLab en el APK:

- Registrar clientes nativos y callbacks propios; definir App Links o un redirect nativo permitido, sin alterar los callbacks web existentes.
- Usar navegador externo y Authorization Code + PKCE S256 con vinculación segura a la instancia nativa. Definir un canje de una sola vez por la sesión SIARE, sin access/refresh en URLs.
- Ampliar y probar el contrato del servidor, estados, nonce, protección contra replay y vinculación reciente. No interpretar los endpoints web actuales como un servidor de autorización OAuth genérico ni enviar ID tokens externos a rutas Bearer de SIARE.
- Mantener Client Secrets en el servidor; no empaquetarlos en la app. Conservar MFA SIARE para ADMIN/SUPERADMIN después del proveedor.
- Acordar almacenamiento Android Keystore, política de backup del dispositivo, recuperación tras pérdida de sesión y conectividad HTTPS de desarrollo.

El código actual fija el callback en `APP_ORIGIN/api/oidc/callback/{provider}` y el BFF instala cookies. Cambiarlo por un deep link arbitrario no está soportado. Referencia del diseño nativo pendiente: [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252).

## Registro, login y sesiones

| Método y ruta | Entrada / resultado |
| --- | --- |
| `POST /auth/register` | `{name,email,password}` → 201 `User`; no abre sesión |
| `POST /auth/login` | `{email,password}` → 200 `Tokens` o desafío MFA |
| `POST /auth/refresh` | `{refreshToken}` → 200 nuevo `Tokens`; sin Bearer previo |
| `POST /auth/logout` | Bearer → 200 `{message}`; revoca la sesión actual |
| `GET /users/me` | Bearer → `User` |
| `GET /users/me/identity` | Bearer → `{userId,role,scopeId,enabled,version}` |
| `GET /users/me/sessions` | Bearer → lista de sesiones activas |
| `DELETE /users/me/sessions/{id}` | Bearer → 200 `{message}`; solo una sesión propia |
| `POST /users/me/sessions/revoke-others` | Bearer → 200 `{message}` |
| `POST /users/me/sessions/revoke-all` | Bearer → 200 `{message}`; también revoca la actual |

Ejemplo de registro, solo datos ficticios:

```json
{"name":"Estudiante de prueba","email":"mobile@example.test","password":"Frase sintética de prueba para desarrollo 2026"}
```

Nombre hasta 100 caracteres, correo hasta 254; contraseña de 15–1024 caracteres Unicode normalizados NFC, hasta 4096 bytes, sin contraseñas comunes. La entrada HTTP también tiene un límite de 2048 unidades Java. El registro depende del parámetro de registro público y crea USER. Una cuenta puede estar deshabilitada y su rol no lo elige el cliente.

`User` contiene `id`, `name`, `email`, `createdAt` (UUID y fechas UTC ISO 8601). Una respuesta de sesión tiene esta forma; los marcadores de tokens son ilustrativos y no son credenciales:

```json
{
  "accessToken":"<JWT SIARE>", "tokenType":"Bearer",
  "expiresAt":"2026-11-18T18:05:00Z",
  "refreshToken":"<opaco base64url de 43 caracteres>",
  "refreshExpiresAt":"2026-11-25T18:00:00Z",
  "sessionId":"00000000-0000-4000-8000-000000000001",
  "challengeToken":null, "challengeExpiresAt":null,
  "mfaRequired":false, "enrollmentRequired":false
}
```

Acceso: cinco minutos por defecto. Sesión: treinta minutos de inactividad, siete días absolutos, hasta cinco sesiones, configurables; MFA puede acortar la vida efectiva. Spring valida firma RS256, issuer, tiempos, UUID, `sid`, `jti`, estado de sesión y permisos en MySQL en cada solicitud. No derives autoridad del rol guardado en la interfaz.

El refresh es de un solo uso y rota en cada canje. Su reutilización revoca la familia de sesión. Implementa una única renovación en curso por sesión para evitar que peticiones concurrentes reutilicen el mismo refresh. Sustituye la pareja almacenada de forma atómica; evita reintentar automáticamente un refresh cuyo resultado se perdió. Si se pierde el token nuevo, inicia sesión de nuevo. Una respuesta 401 requiere distinguir expiración, revocación y fallo de renovación; no entres en bucles infinitos. Guarda el refresh protegido por Keystore y mantén el acceso en memoria cuando sea posible; nunca logs, AsyncStorage sin protección ni parámetros de URL. Logout debe llegar al backend y después limpiar almacenamiento local; si no hay red, no afirmar revocación remota.

## MFA y recuperación

Cuando `mfaRequired=true`, `accessToken`, `refreshToken` y `sessionId` son null. El `challengeToken` opaco dura cinco minutos y no da acceso a rutas protegidas. `enrollmentRequired=true` indica que debe configurarse el factor antes de obtener sesión.

| Método y ruta | Entrada / resultado |
| --- | --- |
| `POST /auth/mfa/enroll` | `{challengeToken}` → `{otpauthUri,expiresAt}` |
| `POST /auth/mfa/confirm` | `{challengeToken,code}` → `{recoveryCodes,session}` |
| `POST /auth/mfa/verify` | `{challengeToken,code}` → `Tokens` |
| `POST /auth/mfa/recover` | `{challengeToken,code}` de recuperación → `Tokens`; revoca sesiones previas |
| `GET /users/me/mfa` | Bearer → `{state,pendingReplacement,recoveryCodesRemaining,required,localPassword}` |
| `POST /users/me/mfa/enroll` | Bearer + `{password,code}` → enrollment |
| `POST /users/me/mfa/confirm` | Bearer + `{code}` → `{recoveryCodes,session}` |
| `POST /users/me/mfa/disable` | Bearer + `{password,code}` → mensaje; permitido solo USER |
| `POST /users/me/mfa/recovery-codes` | Bearer + `{password,code}` → `{recoveryCodes}`; revoca sesiones |
| `POST /auth/password-reset/request` | `{email}` → 202 mensaje genérico |
| `POST /auth/password-reset/complete` | `{token,password}` → 200 mensaje; iniciar sesión de nuevo |

El alta pendiente del factor dura diez minutos. TOTP usa códigos de seis dígitos y rechaza reutilización; guarda la semilla únicamente en el autenticador que la necesita, no en logs, analítica o capturas. Los diez códigos offline se muestran una sola vez y son de un solo uso. La confirmación MFA devuelve una nueva sesión en el campo `session`: reemplaza cualquier sesión anterior. Para cuentas locales la gestión del factor exige contraseña y, si ya está activo, el factor/código de recuperación. Cuentas exclusivamente OIDC requieren sesión primaria reciente en lugar de contraseña. ADMIN y SUPERADMIN no pueden desactivar MFA. El correo SMTP real sigue pendiente; una respuesta 202 no acredita entrega. El enlace de reset actual es web; el enlace nativo requiere diseño y pruebas adicionales.

## Roles

Roles: `USER`, `ADMIN`, `SUPERADMIN`; autorización y ámbitos se resuelven en servidor. Consulta identidad después del login y tras cambios administrativos. `GET /admin/overview`, `/admin/users`, `/admin/scopes`, `/admin/audit` y `/admin/parameters/public-registration` están protegidos según rol/ámbito. Las mutaciones administrativas incluyen control optimista `version`; consulta OpenAPI y [H2-A](H2A_IDENTIDAD.md). Ocultar controles en el APK no sustituye autorización backend.

## Materias

| Método y ruta | Entrada / resultado |
| --- | --- |
| `POST /subjects` | `{name,description}` → 201 `Subject` |
| `GET /subjects` | → lista de materias propias, incluidas archivadas |
| `GET /subjects/{id}` | → materia propia |
| `PATCH /subjects/{id}` | `{name?,description?}` → materia actualizada |
| `PATCH /subjects/{id}/archive` | Sin cuerpo → materia archivada |

`Subject`: `{id,name,description,archived,createdAt,updatedAt}`. Nombre hasta 120 caracteres; descripción hasta 2000. En PATCH al menos un campo; `description:null` limpia la descripción, `name:null` no es válido. No existe DELETE físico ni endpoint de desarchivado. El CRUD actual ofrece creación, consulta, edición y archivado. El servidor limita operaciones al propietario; una materia ajena no debe consultarse cambiando UUID.

## Documentos

| Método y ruta | Entrada / resultado |
| --- | --- |
| `POST /subjects/{subjectId}/documents` | multipart, parte `file` → 201 `Document` |
| `GET /subjects/{subjectId}/documents` | → lista `Document` |
| `GET /documents/{documentId}` | → `Document` |
| `GET /documents/{documentId}/download` | → binario, nombre por Content-Disposition |
| `POST /documents/{documentId}/process` | `Idempotency-Key: <UUID>` opcional → 200 o 202 `Document` |
| `GET /documents/{documentId}/text` | → `Text`; consultar cuando esté listo |

PDF, DOCX, PPTX, JPG/JPEG y PNG; máximo por defecto 15 MiB, envelope multipart hasta 15859712 bytes. El servidor verifica estructura/tipo real. No fijes manualmente Content-Type multipart sin boundary. Procesamiento conserva el original; usa el mismo UUID de idempotencia para la misma operación y consulta estado con espera limitada, sin disparar procesos paralelos indiscriminados. Materias archivadas permiten lectura y descarga, pero no nuevas mutaciones documentales.

`Document` contiene `documentId`, `subjectId`, `originalFilename`, `contentType`, `sizeBytes`, `checksum`, `status` (`UPLOADED`, `PROCESSING`, `READY`, `FAILED`), `createdAt`, `processedAt`, `errorCode`, `operationId`, `leaseUntil`. No hay endpoint público de borrado documental.

`Text` contiene `fileType`, `text`, `fragments`, `unitCount`, `warnings`, `extractionStatus`; cada fragmento contiene `index`, `unitType`, `unitNumber`, `text`. Conserva paginación/unidades de origen en la interfaz. No envíes archivos directamente a Flask ni incorpores su token interno.

## Errores y OIDC web existente

Formato común:

```json
{"timestamp":"2026-11-18T18:00:00Z","status":400,"code":"VALIDATION","message":"Revisa los campos indicados.","fields":{"name":"no debe estar vacío"}}
```

| HTTP | Tratamiento |
| --- | --- |
| 400 | Entrada, UUID, JSON o archivo inválido; mostrar errores de campo |
| 401 | Credencial/desafío inválido, vencido, revocado o reutilizado |
| 403 | Rol, ámbito, cuenta, registro cerrado o MFA requerido |
| 404 | Recurso propio inexistente o proveedor deshabilitado |
| 409 | Correo/identidad duplicados, concurrencia, archivado o estado incompatible |
| 413 / 415 | Tamaño excedido / tipo no admitido |
| 429 | Límite de intentos; espera y evita reintentos rápidos |
| 500 / 503 | Error interno / dependencia no disponible; mensajes sanitizados |

No dependas del texto traducido para lógica; usa estado y `code`. Los códigos documentales/OIDC específicos están en OpenAPI. Los diagnósticos OIDC usan referencias aleatorias; no compartas callback completo, HAR, cookies o tokens.

`GET /auth/oidc/providers` devuelve `{provider,enabled}[]`. Existen `POST /auth/oidc/start`, `POST /auth/oidc/complete`, `POST /users/me/identities/start`, `GET /users/me/identities` y `DELETE /users/me/identities/{id}`. Su flujo actual usa binding, state, nonce, PKCE y el callback web fijo. La vinculación exige confirmación y la misma sesión reciente (cinco minutos); no fusiona automáticamente cuentas por correo y bloquea quitar la última vía de acceso disponible. Documentar estas rutas no las convierte en un contrato OIDC nativo entregado.

Google: login y alta reales confirmados históricamente por el usuario el 11/11/2026. GitLab: el usuario reportó validación manual exitosa de OIDC el 18/11/2026. No aportó desglose de alta/vinculación/MFA/logout ni artefactos adicionales; no se dan por comprobados individualmente. Esta confirmación no es una prueba automatizada ni implementa OIDC nativo. Estado vigente: [GitLab real](H2B2_GITLAB_REAL.md); resultados automatizados históricos en [consolidación](CONSOLIDACION_MAIN.md).

Las API de actividades todavía no existen. Propuestas de catálogo y dependencias con progreso/recomendaciones: [contratos del equipo](CONTRATOS_EQUIPO.md). No tratar esas rutas futuras como operaciones disponibles del OpenAPI actual.
