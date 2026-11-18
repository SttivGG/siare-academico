# H2-B2: identidad federada

Diagnóstico posterior del login real, códigos internos y corrección del desfase
de reloj: [H2B2_GOOGLE_DIAGNOSTICO.md](H2B2_GOOGLE_DIAGNOSTICO.md).

Activación local posterior de GitLab con credenciales aportadas por el usuario,
verificación y confirmación manual exitosa reportada por el usuario el 18/11/2026,
separada de las pruebas automatizadas y sin detalle de subcasos:
[H2B2_GITLAB_REAL.md](H2B2_GITLAB_REAL.md).

Implementación en `feature/h2b2-oidc`, sobre Spring Boot 4.1.2 / Spring Security
7.1.2 y Next.js 16.4.6. MySQL conserva la identidad y las sesiones SIARE. No se
añade PostgreSQL ni otro servicio Docker. Resultados: [H2B2_VALIDACION.md](H2B2_VALIDACION.md).

## Flujo y límites de confianza

1. El navegador envía POST JSON a `/api/oidc/start`, con Origin exacto y
   `X-SIARE-CSRF: 1`. El BFF genera 32 bytes aleatorios de contexto y los guarda
   en cookie HttpOnly, SameSite=Lax, cinco minutos, host y ruta `/`.
2. Next llama a Spring por la red interna. Spring resuelve discovery solamente
   al iniciar un proveedor habilitado. Construye Authorization Code con PKCE
   S256, nonce y state independientes (32 bytes aleatorios cada uno).
3. Redis guarda el contexto, hash del vínculo al navegador, verifier, nonce,
   callback exacto y, en vinculación, UUID de usuario/sesión. TTL de cinco minutos;
   clave derivada de SHA-256(state), prefijo `siare:oidc:flow:`. GETDEL consume el
   estado antes del intercambio, también cuando el intento falla. Redis debe
   estar autenticado, en la red privada; no contiene tokens de proveedor.
4. El proveedor devuelve exclusivamente un código al callback de Next. El BFF
   exige su cookie de contexto, rechaza parámetros duplicados y errores, y envía
   código/state/contexto a Spring mediante POST. Nunca devuelve tokens externos
   ni secretos al cliente. No existe un código interno de intercambio SIARE.
5. `OidcAuthorizationCodeAuthenticationProvider`, el cliente HTTP OAuth2 de
   Spring y `OidcIdTokenDecoderFactory` validan la respuesta, JWKS, RS256
   exclusivamente, issuer exacto, client_id/audience/azp, expiración sin tolerancia
   y nonce. Se admite un desfase de emisión iat de hasta 60 segundos; el validador
   temporal adicional mantiene exp sin tolerancia y verifica nbf si existe.
   Se usa el ID token firmado; no se necesita UserInfo. No se guardan authorized clients ni SecurityContext
   web; la cadena API continúa STATELESS y acepta únicamente Bearer SIARE.
6. La aplicación resuelve `(issuer, subject)` y aplica estado y permisos de
   MySQL. Crea la sesión revocable H2-A o el desafío H2-B1 si MFA está activado o
   el rol lo exige. ADMIN/SUPERADMIN nunca reciben access/refresh antes del MFA
   propio. Los tokens externos no autorizan la API SIARE.
7. Next instala cookies SIARE HttpOnly y redirige con 303 a rutas fijas:
   `/inicio`, `/login/mfa`, `/seguridad` o `/login`. Callback y respuestas OIDC
   usan `Cache-Control: no-store` y `Referrer-Policy: no-referrer`. La cookie del
   flujo se borra. No se permiten destinos aportados por el navegador.

Cada nuevo inicio reemplaza el contexto de ese proveedor en ese navegador.
Un flujo fallido, vencido, cancelado o iniciado en otra pestaña debe reiniciarse.
La pérdida/reinicio de Redis puede cancelar flujos pendientes; las sesiones
SIARE existentes siguen dependiendo de MySQL y RSA, no de Redis.

## Google

En Google Cloud, para el cliente de tipo **aplicación web**, pegar exactamente
este valor en **URI de redireccionamiento autorizados**, sin barra final:

```text
http://127.0.0.1:3100/api/oidc/callback/google
```

El callback HTTP lo recibe **Next.js (BFF)**, en
`frontend/src/app/api/oidc/callback/[provider]/route.ts`. Después, Next envía
el código mediante POST interno a Spring, en `/api/v1/auth/oidc/complete`,
para el intercambio y la validación OIDC. Spring mantiene su puerto de host
`127.0.0.1:8180`; Next mantiene `127.0.0.1:3100`.
La URI anterior es la dirección del navegador para desarrollo local:
`127.0.0.1` es loopback, no un dominio público de Internet. Abrir SIARE desde
`http://127.0.0.1:3100` para conservar el mismo origen y las cookies del flujo.

Registrar un cliente OAuth de tipo **aplicación web**, configurar el consentimiento
y los usuarios de prueba cuando proceda. Usar discovery de
`https://accounts.google.com/.well-known/openid-configuration`, issuer exacto
`https://accounts.google.com`; scopes `openid email profile`. No se pide acceso
offline ni permisos adicionales. El alta exige correo presente y
`email_verified=true`. La identidad estable es issuer/sub, nunca el correo.

Variables externas (también declaradas vacías en `.env.example`):

```dotenv
GOOGLE_OIDC_ENABLED=true
GOOGLE_CLIENT_ID=<valor registrado>
GOOGLE_CLIENT_SECRET=<secreto externo>
GOOGLE_ISSUER=https://accounts.google.com
GOOGLE_REDIRECT_URI=http://127.0.0.1:3100/api/oidc/callback/google
```

## GitLab.com sustituye a Microsoft

El 11/11/2026 se descarta Microsoft Entra por no disponer de la suscripción o
configuración de facturación necesaria para registrar la aplicación. Los dos
proveedores de H2-B2 son **Google y GitLab.com**. Se retiran el código y las
opciones de Microsoft; las variables antiguas de un `.env` externo se ignoran.
No se convierten identidades antiguas en GitLab, no se borran filas y no se
modifican V1/V2/V3/V4. Una identidad histórica retirada sigue consultable y
puede desconectarse con las restricciones existentes; no cuenta como vía de
acceso habilitada. Las sesiones SIARE existentes conservan su ciclo revocable.

Registrar una aplicación en [GitLab.com → Applications](https://gitlab.com/-/user_settings/applications):

1. Indicar nombre y la Redirect URI exacta de la tabla siguiente.
2. Mantener **Confidential** activado: el secreto permanece exclusivamente en Spring.
3. Seleccionar únicamente `openid`, `profile` y `email`; no solicitar `api`,
   `read_user`, repositorios ni acceso offline.
4. Copiar el Application ID y secreto reales a las variables externas. Dejar
   GitLab deshabilitado hasta disponer de ambos; nunca pegar secretos en el frontend.

```dotenv
GITLAB_OIDC_ENABLED=false
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
GITLAB_ISSUER=https://gitlab.com
GITLAB_REDIRECT_URI=http://127.0.0.1:3100/api/oidc/callback/gitlab
```

Activar `GITLAB_OIDC_ENABLED=true` solo tras completar el registro. No se han
inventado ni añadido credenciales al `.env` real. Google conserva su configuración.

Discovery: `https://gitlab.com/.well-known/openid-configuration`; issuer exacto
`https://gitlab.com`. Se rechazan instancias Self-Managed y emisores alternativos.
El discovery oficial anuncia RS256, `client_secret_post` y PKCE `S256`, usados
por el mismo flujo web confidencial. GitLab no recibe `prompt=select_account`;
Google conserva su selector de cuenta. State, nonce, verifier y callback quedan
ligados al flujo de un solo uso de Redis y a la cookie del navegador.

Se usa `(issuer, subject)` para identificar. Nunca se usan username, email,
grupos ni roles externos para dar permisos. Todo usuario nuevo obtiene USER;
ADMIN/SUPERADMIN completan el MFA SIARE antes de recibir sesión.

Solo un correo válido con `email_verified=true` puede ser contacto de la cuenta.
GitLab puede omitir estos claims por la visibilidad del correo; si faltan, son
inválidos o no verificados, el alta usa `<UUID>@federated.invalid`, que no es
una dirección de entrega ni habilita recuperación por correo. Un correo
coincidente con una cuenta existente exige entrar en SIARE y vincular desde
Seguridad, con confirmación y sesión reciente. No se fusionan cuentas.

## Callbacks exactos

| Proveedor | URI que debe registrarse |
| --- | --- |
| Google | `http://127.0.0.1:3100/api/oidc/callback/google` |
| GitLab.com | `http://127.0.0.1:3100/api/oidc/callback/gitlab` |

Spring sigue en `127.0.0.1:8180` y Next en `127.0.0.1:3100`. El proveedor
redirige a Next. No registrar `/login/oauth2/code/*` en Spring.
GitLab permite HTTP para desarrollo local; registrar la URI completa sin barra
final y abrir siempre `http://127.0.0.1:3100`. No mezclar cookies entre localhost
y 127.0.0.1.
En producción usar HTTPS, origen exacto y `SESSION_COOKIE_SECURE=true`.
El código rechaza HTTP sobre hosts públicos y callbacks diferentes del origen
configurado más la ruta fija del proveedor.

Cada proveedor necesita opt-in y sus dos credenciales. La ausencia de cualquiera desactiva ese proveedor y la UI
presenta botones deshabilitados. No se inventaron credenciales y no se modificó
el `.env` real. Redis usa `REDIS_PASSWORD` existente; no cambia su clave.
Tras configurar secretos externamente, recrear solo los servicios de aplicación
con los dos Compose; no borrar volúmenes. Discovery es diferido, por lo que un
proveedor caído no impide iniciar la aplicación ni autenticarse localmente.

## Vinculación, desvinculación y MFA

En Seguridad, iniciar sesión hace menos de cinco minutos, marcar confirmación y
elegir la cuenta del proveedor. El UUID SIARE y sus materias/documentos se
conservan. Spring exige el mismo Bearer de sesión que conserva el BFF y vuelve a verificar que la sesión original siga activa al
consumir el callback. El contexto no permite elegir otro usuario ni otra sesión.

No se vincula por correo. Un correo coincidente produce 409 y pide entrar por
una vía existente. Una identidad ya conectada produce conflicto, incluso para
su propietario. Una identidad no se puede trasladar a otro usuario.

V4 añade `external_identities` (UUID, usuario, proveedor, issuer, subject y fecha),
unicidad exacta binaria de issuer/subject e índice por usuario. La fila
`federation_control` serializa altas/vinculaciones/desvinculaciones; después se
bloquea `user_access`. La creación de usuario USER e identidad es una única
transacción. La unicidad de correo conserva su autoridad frente a un registro
local concurrente. Esta serialización prioriza corrección al volumen actual;
revisarla con mediciones antes de escalar, sin sustituirla por locks de proceso.
V1/V2/V3 permanecen intactas. No se persisten tokens externos ni perfiles completos.

La desconexión exige sesión reciente y confirmación en UI. No puede eliminar
la última vía disponible: contraseña local utilizable u otra identidad de un
proveedor habilitado. Cierra otras sesiones y registra auditoría. La cuenta
exclusivamente federada usa marcador `!OIDC`, que jamás valida una contraseña.
Los eventos `OIDC_REGISTER`, `OIDC_LINK`, `OIDC_LOGIN` y `OIDC_UNLINK` usan la
auditoría existente, sin códigos ni tokens.

Las sesiones sin segundo factor federadas registran nivel OIDC; con segundo
factor registran MFA. El refresh conserva el nivel y aplica el rol/estado actual
de MySQL. Para gestionar MFA, las cuentas locales siguen necesitando contraseña
y, cuando existe, factor actual. Las cuentas sin contraseña necesitan un login
OIDC/MFA de menos de cinco minutos y el factor actual para reemplazar,
regenerar o desactivar. La confirmación del nuevo TOTP y las revocaciones
mantienen el comportamiento H2-B1. El rol administrativo siempre exige MFA.

## Operación y clientes móviles

No registrar query strings de callbacks, cuerpos OAuth2, headers Authorization,
cookies, códigos ni tokens en proxies/APM. Los DTO sensibles tienen toString
redactado y no hay logs de payload en el código añadido. El frontend carece de
secreto OAuth2. El BFF genérico no permite iniciar/completar OIDC, para impedir
que el navegador elija su propio contexto de vinculación.

React Native necesita un registro de **cliente público** independiente,
Authorization Code + PKCE, navegador del sistema, redirects de aplicación o
universal/app links verificados y almacenamiento seguro del dispositivo. Nunca
incluir el secreto web ni cargar el login en WebView. No reutilizar las cookies
ni el callback BFF como API móvil. Diseñar un intercambio propio ligado al
verifier y al cliente móvil, manteniendo MFA SIARE y sesiones revocables; no
aceptar tokens Google/GitLab directamente como Bearer SIARE. La implementación
móvil y su validación real siguen pendientes.

## Referencias verificadas

- [Spring OAuth2 y PKCE](https://docs.spring.io/spring-security/reference/servlet/oauth2/client/authorization-grants.html).
- [Validación OIDC de Spring](https://docs.spring.io/spring-security/reference/servlet/oauth2/login/advanced.html).
- [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect).
- [GitLab OIDC y claims](https://docs.gitlab.com/integration/openid_connect_provider/).
- [Discovery de GitLab.com](https://gitlab.com/.well-known/openid-configuration).
- [GitLab Authorization Code + PKCE y redirects](https://docs.gitlab.com/api/oauth2/).

La entrega real del correo SMTP es un pendiente anterior de H2-B1. No se ha
convertido en una entrega validada por añadir OIDC.
