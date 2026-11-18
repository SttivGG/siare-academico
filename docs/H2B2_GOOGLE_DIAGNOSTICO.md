# Diagnóstico del login real de Google — 11/11/2026

## Causa confirmada

El reintento real produjo `OIDC_TOKEN_ISSUED_IN_FUTURE`, HTTP 401 en Spring,
con referencia `9dc31b66-6a76-43ba-bc87-12ec25262fb4`, coincidente en Next y Spring.
La fecha de emisión (`iat`) del ID token estaba por delante del reloj del verificador.
`OidcProtocol` imponía `setClockSkew(Duration.ZERO)` también para `iat`.
Una comprobación independiente del encabezado Date de discovery de Google desde
el contenedor mostró aproximadamente un segundo de diferencia. El desfase exacto
de aquel token no se registró; el rechazo de `iat` sí quedó confirmado.

La corrección admite como máximo 60 segundos de desfase de emisión y combina
el validador OIDC con `JwtTimestampValidator(Duration.ZERO)`. Así, `exp` continúa
sin tolerancia y también se comprueba `nbf` cuando existe. Un adelanto de 120
segundos se rechaza. Se conservan firma RS256, issuer, audience/azp, nonce, PKCE,
consumo único de state y las reglas de sesión/MFA.

La [API oficial de Spring](https://docs.spring.io/spring-security/reference/api/java/org/springframework/security/oauth2/client/oidc/authentication/OidcIdTokenValidator.html)
documenta 60 segundos como tolerancia predeterminada de ese validador. En SIARE
se añade explícitamente la comprobación estricta de expiración para que esa
tolerancia no alargue la validez de un token expirado.

## Recorrido inspeccionado

1. Next exige POST del mismo origen y cabecera CSRF para iniciar. Su cookie
   HttpOnly `siare_oidc_google` contiene un contexto aleatorio y el modo
   login/vinculación; usa SameSite=Lax, ruta `/` y cinco minutos de vida.
   `SESSION_COOKIE_SECURE=false` es coherente con el HTTP de loopback actual.
2. Spring genera state, nonce y verifier independientes. Redis conserva el
   contexto y el hash de vinculación al navegador con TTL de cinco minutos;
   GETDEL consume state una sola vez, incluso si el intento falla. PKCE usa
   S256. El nonce enviado es el hash del nonce interno, que Spring vuelve a
   comprobar contra el ID token.
3. El callback de Next rechaza parámetros duplicados, errores del proveedor,
   códigos fuera del límite y contexto ausente. Envía el código exclusivamente
   por POST interno a `/api/v1/auth/oidc/complete` y borra su cookie al terminar.
4. El canje utiliza el redirect guardado al iniciar y credenciales solo en Spring.
   El fallo real alcanzó la validación del ID token después del canje.
   No fue un rechazo de callback, cookie, PKCE ni nonce en ese reintento.
5. La configuración efectiva del contenedor coincide con `.env`: Google
   habilitado, client ID y secreto presentes e iguales a los cargados, issuer
   `https://accounts.google.com`, origen `http://127.0.0.1:3100` y callback exacto:

   ```text
   http://127.0.0.1:3100/api/oidc/callback/google
   ```

   Coincide carácter por carácter con el valor de Google Cloud aportado por el
   usuario. No se tuvo acceso administrativo a la consola de Google.
   Los scopes del registro Spring son `openid email profile`.
6. Next usa `CORE_API_URL=http://core-api:8080`; una consulta desde ese contenedor
   al endpoint de proveedores devolvió HTTP 200 y Google habilitado.
   Microsoft permanece deshabilitado. No se imprimieron las credenciales.

## Alta y vinculación

La identidad se resuelve por `(issuer, subject)`. Una identidad ya vinculada
entra con su usuario SIARE y sus permisos/estado actuales; continúa por MFA
cuando corresponde. El cambio de correo no cambia su propietario.

Una identidad Google nueva necesita correo válido y verificado y registro
público habilitado. El usuario y su identidad se crean en una sola transacción,
con rol USER y marcador `!OIDC` que no acepta contraseña. El bloqueo de
federación y las restricciones únicas evitan duplicados concurrentes.

Un correo que ya pertenece a otra cuenta produce `OIDC_EMAIL_LINK_REQUIRED`,
HTTP 409, sin crear usuario ni identidad. Esto se comprueba también cuando el
registro público está cerrado y ante una colisión de alta local concurrente.
La UI ofrece entrar con la cuenta existente y vincular desde Seguridad.
La vinculación exige confirmación y la misma sesión autenticada reciente,
que se vuelve a comprobar al completar. Una identidad vinculada no se traslada
a otro usuario. Los demás conflictos tienen mensajes propios.

`/registro` ahora reutiliza los botones de acceso externo, incluida la opción
«Continuar con Google», y explica la vinculación desde una cuenta existente.

## Qué ocultaba el mensaje anterior

El callback convertía respuestas distintas en `oidc=fallo` o `oidc=proveedor`;
la página mostraba para ambas el mismo texto de imposibilidad de verificar la
identidad. Además, `OidcController` descartaba el motivo de
`OAuth2AuthenticationException`. El texto original por sí solo no permitía
atribuir el fallo a una validación concreta.

Ahora hay códigos separados para contexto, configuración, discovery, Redis,
rechazo del cliente/código en el canje, respuesta inválida, issuer, audience,
azp, expiración, emisión futura, nonce, tenant y políticas de cuenta. Las
indisponibilidades tienen HTTP 503. Next distingue además fallos de transporte,
respuesta interna y sesión SIARE inválida.

Los logs propios contienen etiquetas internas, estado HTTP y una referencia
UUID aleatoria independiente de state, códigos y tokens. Spring registra la
ruta interna y etapa; Next registra proveedor y etapa. No se registran cuerpos,
excepciones completas, códigos OAuth, JWT, tokens, cookies, secretos, correos
ni perfiles. Next acepta únicamente una lista fija de códigos para mostrar o
registrar; descarta descripciones/códigos arbitrarios del upstream. El callback
mantiene `no-store` y `no-referrer`.

## Repetir la prueba real

1. Abrir `http://127.0.0.1:3100/registro` o `/login`, siempre desde 127.0.0.1.
   Pulsar «Continuar con Google» e iniciar un flujo nuevo; no reutilizar un
   callback previo. Elegir una cuenta admitida como usuario de prueba.
2. Con una identidad y correo nuevos, debe crearse un USER y abrir `/inicio`
   (o continuar por el MFA SIARE si corresponde). Cerrar sesión y repetir con
   esa identidad debe conservar el mismo usuario y sus datos.
3. Si el correo ya tiene una cuenta local, debe aparecer la indicación de
   vinculación, sin crear duplicados. Entrar con esa cuenta, abrir Seguridad,
   confirmar y vincular Google antes de que pasen cinco minutos desde el login.
   Después, cerrar sesión y entrar mediante Google.
4. Si falla, compartir solo el código «Diagnóstico» y la «Referencia» del login.
   No compartir la URL del callback ni exportar HAR, cookies o tokens.

No se modificaron `.env`, claves RSA ni migraciones; no se borraron volúmenes
ni datos. Solo se reconstruyen/recrean las aplicaciones. No hay commit ni push.

## Regresiones

Resultado: 120 pruebas Java correctas, incluidas 38 OIDC; 19 unitarias frontend,
cinco de BFF compilado y cuatro recorridos de navegador (escritorio/móvil).
Build de ambas imágenes y comprobación TypeScript correctos.

La corrección está activada en los contenedores de Next y Spring. Tras la
recreación, los nueve servicios están saludables, Next informa UP y consulta
Google habilitado por la red interna. Las huellas de `.env` y de ambas claves
RSA coinciden antes y después de esa activación.

Se prueban el desfase pequeño con reloj fijo y proveedor firmado de loopback,
el adelanto excesivo, tokens expirados hace dos segundos, firma/issuer/audience/
azp/nonce incorrectos, replay, errores de canje, indisponibilidad, alta USER,
cuenta local coincidente, vinculación, registro cerrado, concurrencia y MFA.
Las pruebas de protocolo controladas no sustituyen la confirmación en Google real.

Evidencias locales, sin credenciales de Google en las pruebas:

- `.cache/h2b2-google-clock-build-final.log`: construcción y suite Java completa.
- `.cache/h2b2-google-clock-tests-final.log`: pruebas OIDC enfocadas.
- `.cache/h2b2-google-bff-tests.log`: Next compilado y upstream controlado;
  además verifica que los registros no contengan los valores señuelo sensibles.
- `.cache/h2b2-google-browser-final.log`: registro, disponibilidad, errores y
  vinculación en escritorio y móvil con disponibilidad controlada.
- `.cache/h2b2-google-register-{desktop,mobile}.png`: capturas del registro.

Confirmación de Google real después de activar la corrección: el usuario
confirmó el 11/11/2026 (America/Bogota) que funcionan tanto el inicio de sesión
como la creación de una cuenta nueva. Esta confirmación corresponde a esos dos
recorridos; la vinculación de una cuenta local y MFA conservan la evidencia de
las regresiones controladas, sin una confirmación adicional con Google real.
