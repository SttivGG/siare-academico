# H2-B1: MFA y recuperación de cuentas

Rama `feature/h2b-mfa-recuperacion`. Fecha: 11/11/2026, America/Bogota.
OIDC y aplicación móvil quedan fuera de este cambio. No se hacen commit ni push.
Los cambios H2-A ya presentes en el árbol se conservan.

## Autoridad y límites

MySQL conserva credenciales, estados, desafíos, consumo de códigos, sesiones,
intentos y auditoría. Redis no interviene en decisiones MFA: su caída no habilita
ningún acceso. V3 amplía sesiones sin cambiar V1/V2 ni sus checksums. Las sesiones
anteriores conservan nivel PASSWORD. Cada petición valida la sesión persistida;
las operaciones administrativas vuelven a exigir rol, ámbito, factor activo y
nivel MFA vigente. El servidor ignora cualquier pretensión del cliente sobre MFA.

TOTP sigue [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238.html): SHA-1, seis
dígitos, semilla de 160 bits de SecureRandom, periodos de 30 segundos, ventana de
un periodo anterior y uno siguiente. Se conserva el mayor paso aceptado y se
rechaza cualquier paso menor o igual; esperar al siguiente código después de
activar o reautenticar. Configurar sincronización horaria automática en servidor
y autenticador. Nunca se registra la semilla ni se vuelve a exponer en estado.

Un desafío vence en cinco minutos y admite como máximo cinco operaciones
(incluidos alta y confirmación); cada nueva validación de contraseña invalida
los desafíos anteriores de esa cuenta. El límite compartido MFA es de cinco
operaciones por cuenta en quince minutos. Los contadores son MySQL, compartidos
entre nodos. Se mantienen los límites H2-A de primer factor: cinco por cuenta en
quince minutos y 120 globales por minuto. Las mutaciones MFA usan el mismo
presupuesto global. Los límites también cuentan operaciones válidas.

Todas las mutaciones bloquean `user_access` antes de desafío, credencial y
sesiones. La lectura final es bloqueante para evitar snapshots antiguos en
REPEATABLE READ. Fallos y consumo de intentos se confirman antes de devolver 401.
Código TOTP, código offline y token de contraseña se consumen atómicamente.

## Flujos

1. Login comprueba contraseña y estado de cuenta. USER sin MFA obtiene sesión
   PASSWORD; cualquier cuenta con MFA y todo ADMIN/SUPERADMIN reciben solo un
   desafío opaco. No se crean access, refresh ni sesión privilegiada.
2. Con factor activo se verifica TOTP o un código offline. Sin factor, un
   administrador usa el desafío provisional para darlo de alta. No hay permisos
   académicos ni administrativos asociados al desafío.
3. El alta permanece PENDING durante diez minutos. Solo el código del nuevo
   factor activa la credencial, revoca sesiones y desafíos y emite una sesión MFA.
   Se generan diez códigos de recuperación que se muestran una sola vez.
4. La sesión MFA tiene plazo máximo de doce horas, además de inactividad y plazo
   absoluto H2-A. Refresh conserva el nivel y su fecha límite; nunca lo eleva ni
   extiende. Repetir login y segundo factor cuando vence.
5. Configurar/reemplazar requiere contraseña actual y, si ya existe un factor,
   TOTP o recuperación sin usar. El factor anterior permanece activo hasta
   confirmar el nuevo. Restablecer contraseña invalida altas pendientes.
6. Desactivar MFA exige contraseña y factor y solo se permite a USER. ADMIN y
   SUPERADMIN pueden reemplazarlo, conservando siempre MFA obligatorio.
7. Regenerar códigos exige contraseña y factor, invalida los diez anteriores y
   cierra todas las sesiones. Tras guardar los nuevos códigos se inicia sesión.

Los códigos offline tienen 128 bits aleatorios, 22 caracteres Base64URL. Solo se
persisten hashes SHA-256 ligados al UUID. El login con recuperación exige primero
contraseña y desafío válido, también para SUPERADMIN, y revoca las sesiones
anteriores. El correo no sustituye ese segundo factor.

## Recuperación de contraseña y correo

La solicitud responde siempre 202 con el mismo mensaje para cuentas disponibles,
inexistentes o limitadas. Una cola acotada (un worker, 32 trabajos) procesa lookup
y SMTP fuera de la respuesta pública. Si se llena, se devuelve el mismo resultado
y se audita. No hay cola duradera: un cierre antes de enviar requiere solicitar
otro enlace. Cada solicitud tiene el límite H2-A por dirección; completar tiene
un presupuesto de cinco intentos/15 min por token y otro por cuenta, además del
global. El token contiene 256 bits de SecureRandom; solo SHA-256 llega a MySQL.
Vence a los quince minutos y una nueva solicitud invalida los anteriores.

El enlace usa `/recuperar/confirmar#token=...`: el fragmento no llega a logs HTTP
ni Referer y el frontend lo retira al cargar. La contraseña nueva pasa la misma
política y bloqueo de contraseñas comunes H2-A y se guarda con Argon2id. La
transacción consume el token, invalida otros tokens y desafíos, elimina semillas
pendientes, revoca sesiones y conserva MFA activo, códigos offline y roles. No
inicia sesión ni concede permisos. Se envía una notificación de cambio.

El adaptador real usa JavaMailSender con STARTTLS obligatorio, validación del
nombre TLS, depuración desactivada y timeouts de cinco segundos, siguiendo la
[integración de correo Spring](https://docs.spring.io/spring-boot/reference/io/email.html).
Configurar fuera de Git `H2B1_SMTP_HOST`, `H2B1_SMTP_PORT` (587 por defecto),
`H2B1_SMTP_USERNAME`, `H2B1_SMTP_PASSWORD`, `H2B1_SMTP_FROM` y `APP_ORIGIN`.
No se permite SMTP sin TLS como alternativa implícita. La URL pública debe usar
HTTPS en despliegue y `SESSION_COOKIE_SECURE=true`.

Sin SMTP, la API no revela la existencia de cuentas: audita fallo de entrega.
Las pruebas sustituyen solo el adaptador de correo por captura efímera; usan la
criptografía y los flujos reales. Esto no acredita recepción de correo real.
Antes de declarar recuperación de extremo a extremo, comprobar con un buzón
controlado solicitud, recepción, enlace, cambio, notificación y nuevo login MFA.

## Clave de cifrado y respaldo

AES-256-GCM usa nonce aleatorio de 96 bits, etiqueta de 128 bits y AAD con versión,
propósito y UUID: no se puede trasladar una credencial cifrada a otra cuenta.
El formato `v1.` permite reconocer la versión del sobre. La clave no es RSA y no
se genera en el arranque de Spring. Una clave ausente, errónea o semilla alterada
provoca fallo cerrado. No se intenta descifrar con claves alternativas.

Provisionar una sola vez con `scripts/Initialize-H2B1.ps1 -FirstProvision`, después
de comprobar que esta instancia nunca tuvo factores cifrados. Sin ese parámetro,
el script solo valida la clave existente y exige restaurar si falta. En Windows el archivo
externo queda en `%LOCALAPPDATA%/SIARE/identity/totp.key`, con herencia ACL desactivada
y acceso para su propietario. El script conserva la clave existente y usa
CreateNew. `H2B1_MFA_KEY_FILE` permite otro archivo absoluto **fuera del repositorio**;
en Linux es obligatorio configurarlo y restringir permisos del archivo al runtime.
Compose lo monta solo lectura y no crea una ruta ausente. No ejecutar el
aprovisionamiento para reparar una clave perdida: restaurar el respaldo exacto.

Antes de un alta real, custodiar una copia cifrada de la clave con acceso separado
del respaldo MySQL, registrando responsables y fecha. El respaldo de volúmenes
H1 no incluye este archivo externo. Exigir dos responsables para recuperarlo;
detener solo core-api, verificar huella del archivo contra el inventario privado,
restaurarlo en la ruta configurada con ACL restringida y arrancar sin generar
clave nueva. Verificar un factor en una cuenta de prueba y la auditoría sin
mostrar claves/semillas. Recuperar MySQL y clave correspondientes al mismo juego
de respaldos. No se incluye rotación automática de claves: requiere una operación
controlada que recifre todos los sobres y un nuevo respaldo verificable.

## Primer SUPERADMIN y pérdida total de factores

Se conserva el bootstrap interactivo H2-A, idempotente, sin usuario público
privilegiado ni credenciales de entorno/argumentos. Tras el primer factor, el
SUPERADMIN recibe el mismo desafío provisional sin JWT. Solo después de escanear,
confirmar y guardar códigos offline obtiene sesión MFA y sus permisos existentes.

Ante pérdida de todos los factores, el correo por sí solo es insuficiente.
Abrir un expediente institucional; dos responsables independientes verifican la
identidad por un canal presencial o institucional previamente registrado, y
contrastan rol y ámbito con el expediente autorizado. Revocar sesiones y
desafíos, suspender temporalmente la cuenta y conservar evidencia/auditoría.
Un DBA y el responsable de seguridad realizan el cambio excepcional en una
transacción controlada con bloqueo de `user_access`: invalidan códigos y desafíos,
retiran la credencial inaccesible, revocan sesiones y anexan un evento
`MFA_IDENTITY_RECOVERY` con el identificador del expediente, sin datos personales.
Rehabilitar la cuenta únicamente tras aprobar identidad y restablecer de forma
independiente su primer factor. El siguiente login vuelve al alta provisional;
no existe una sesión administrativa intermedia. Comprobar nuevo factor y
notificar al titular por canales previos. No se ofrece endpoint, código maestro,
bandera de bypass ni SQL público que omita estas verificaciones. Este
procedimiento requiere responsables institucionales asignados y un ensayo
supervisado antes de emplearlo con una cuenta real.

## Puertos, adaptadores y contratos

Los seis puertos de entrada solicitados se implementan en `MfaService` y
`PasswordResetService`. `MfaRepository`, `TotpPort`, `PasswordResetRepository` y
`SecurityMailPort` separan JDBC, criptografía y SMTP. Dominio y aplicación no
dependen de JPA, Redis ni Spring Security. `SessionMfaPolicy` adapta el contexto
JWT al estado persistido; cada operación administrativa mantiene el RBAC H2-A.
La auditoría usa `AuditPort` y el manejo de errores existente.

Los contratos completos están en [openapi.json](openapi.json). Nuevas rutas:

| Método | Ruta bajo `/api/v1` | Autorización |
| --- | --- | --- |
| GET | `/users/me/mfa` | Sesión |
| POST | `/users/me/mfa/enroll` | Sesión + reautenticación |
| POST | `/users/me/mfa/confirm` | Sesión + TOTP pendiente |
| POST | `/users/me/mfa/disable` | USER + contraseña + factor |
| POST | `/users/me/mfa/recovery-codes` | Sesión + contraseña + factor |
| POST | `/auth/mfa/enroll` | Desafío después de contraseña válida |
| POST | `/auth/mfa/confirm` | Desafío + TOTP pendiente |
| POST | `/auth/mfa/verify` | Desafío + TOTP activo |
| POST | `/auth/mfa/recover` | Desafío + recuperación sin usar |
| POST | `/auth/password-reset/request` | Pública, respuesta uniforme |
| POST | `/auth/password-reset/complete` | Token de uso único |

La web ofrece `/seguridad`, `/login/mfa`, `/recuperar` y
`/recuperar/confirmar`. Conserva cookies HttpOnly, CSRF, ausencia de tokens en
localStorage, protección de rutas, pegado/autocompletado, etiquetas, avisos y
estados de carga. El BFF selecciona el desafío exclusivamente desde su cookie,
filtra respuestas de tokens y genera QR localmente con `qrcode`.
