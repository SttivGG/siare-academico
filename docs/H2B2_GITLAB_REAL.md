# GitLab.com: configuración local y validación real

El registro externo de SIARE Académico ya fue creado por el usuario como
aplicación confidencial, con permisos `openid`, `profile` y `email` y callback:

```text
http://127.0.0.1:3100/api/oidc/callback/gitlab
```

## Estado verificado de la activación

El usuario introdujo Application ID y Client Secret en el `.env` local.
Se activó `GITLAB_OIDC_ENABLED=true`, sin mostrar ni copiar las credenciales
a documentación, código o Git. `.env` sigue ignorado y no versionado.

Se recreó exclusivamente `core-api`, sin construir imágenes. Los otros ocho
contenedores conservaron su identidad, Next no se reinició y los nueve
servicios quedaron saludables. Las cinco variables efectivas Google conservaron
sus huellas, y las diez variables GitLab/Google del contenedor coinciden con
Compose resuelto. Next no recibe los Client Secret.

Spring y el BFF anuncian ambos proveedores habilitados. Se verificó el inicio
de Google y GitLab con discovery real, Code + PKCE S256, scopes mínimos,
callback exacto, state/nonce y cookie HttpOnly. En Chrome, sin mocks, los
botones de registro/login están habilitados a 1440 y 375 px y no hay opciones
Microsoft ni desbordamiento horizontal. Evidencia privada ignorada:
`.cache/h2b2-gitlab-activation-check.log` y
`.cache/h2b2-gitlab-live-{registro,login}-{desktop,mobile}.png`.

Esto no acredita todavía la validez del Client Secret ante el token endpoint:
falta que el usuario complete los recorridos manuales siguientes. No se hizo
commit ni push.

## Introducir las credenciales

Abrir el `.env` de la raíz con un editor local. Completar las entradas
`GITLAB_CLIENT_ID` y `GITLAB_CLIENT_SECRET` con el Application ID y Client
Secret reales, entre comillas simples. Cambiar `GITLAB_OIDC_ENABLED` a `true`.
Conservar `GITLAB_ISSUER=https://gitlab.com` y el callback anterior en
`GITLAB_REDIRECT_URI`. Guardar sin añadir entradas duplicadas.

No introducir los valores en el chat, comandos del terminal, documentación,
`.env.example` ni código. `.env` está ignorado y no versionado; conservar esa
condición. Las credenciales permanecen en Spring: Next consulta disponibilidad
y envía los intercambios al backend, sin recibir Client Secret.

Cambiar `.env` requiere **recrear únicamente `core-api`** con los Compose de
la instancia: `up -d --no-deps --wait --wait-timeout 180 core-api`. Un simple
`restart` no carga variables nuevas. No hace falta reconstruir imágenes ni
reiniciar Next, las otras aplicaciones o las bases de datos.

## Comprobaciones antes del login real

- Spring y el BFF de Next deben anunciar `google` y `gitlab` habilitados.
- Los botones «Continuar con Google» y «Continuar con GitLab» deben estar
  habilitados en registro y login al recargar las páginas.
- El inicio de GitLab debe usar `https://gitlab.com/oauth/authorize`,
  `response_type=code`, PKCE S256, los tres scopes mínimos, state y nonce,
  y el callback exacto. Esto comprueba discovery e inicio, no el canje del
  código ni la validez del secreto frente al token endpoint.
- Las huellas de las cinco variables efectivas Google deben conservarse.
  Los otros ocho contenedores deben mantener su identidad y los nueve
  servicios deben quedar saludables. No imprimir variables ni URLs OAuth.

## Recorridos manuales

1. Abrir [Registro](http://127.0.0.1:3100/registro) usando siempre ese origen.
   Pulsar «Continuar con GitLab», comprobar que la autenticación ocurre en
   GitLab.com y autorizar los tres permisos. Con identidad y correo nuevos,
   esperar `/inicio`, usuario USER y materias accesibles. Si el correo ya
   existe, esperar la indicación de entrar en SIARE y vincular desde Seguridad,
   sin crear una cuenta duplicada. No guardar ni compartir la URL del callback.
2. Cerrar la sesión SIARE. Abrir
   [Inicio de sesión](http://127.0.0.1:3100/login), entrar con la misma identidad
   GitLab y comprobar que se conservan la cuenta y sus materias. La selección
   de cuenta externa depende de la sesión que esté abierta en GitLab.
3. Para una cuenta existente, iniciar sesión por su vía habitual, abrir
   Seguridad y confirmar «Vincular GitLab» antes de cinco minutos. Después del
   consentimiento, verificar la identidad conectada. Cerrar sesión y entrar
   con GitLab; deben conservarse el usuario SIARE y sus datos.
4. Si la cuenta tiene rol ADMIN/SUPERADMIN, exigir el MFA SIARE antes del
   acceso administrativo, aunque GitLab ya haya completado su autenticación.
5. Cerrar sesión y comprobar que las rutas privadas vuelven a exigir login.
   Repetir el login con Google para confirmar la continuidad de su recorrido.

Si falla, comunicar solo el código «Diagnóstico» y la «Referencia» mostrados
por SIARE. No compartir Client Secret, cookies, códigos, tokens, HAR ni query
strings OAuth. Un reintento debe empezar con el botón, nunca reutilizar el
callback anterior.

El inicio y alta reales con Google ya estaban confirmados por el usuario;
se conserva esa evidencia en [H2B2_GOOGLE_DIAGNOSTICO.md](H2B2_GOOGLE_DIAGNOSTICO.md).
El login completo de GitLab requiere que el usuario autentique su cuenta y
confirme el resultado. No se considera validado por habilitar el proveedor
o recibir una URL de autorización.
