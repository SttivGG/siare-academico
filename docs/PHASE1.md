# Fase 1: cuentas, sesión y materias

## Probar la interfaz

Inicia SIARE con `scripts/Start-Siare.ps1`. Si `.env` no existe, ejecuta primero `scripts/Initialize-Siare.ps1`. La inicialización conserva las credenciales existentes; el arranque prepara las claves RSA persistentes y aplica las migraciones sin reinicializar volúmenes.

1. Abre <http://127.0.0.1:3100/registro>.
2. Escribe nombre, correo y contraseña de al menos 10 caracteres y hasta 72 bytes UTF-8. El correo se normaliza a minúsculas y sin espacios en los extremos.
3. Inicia sesión en <http://127.0.0.1:3100/login>.
4. Desde el inicio, abre **Mis materias** y selecciona **Crear materia**.
5. Indica el nombre y, si quieres, una descripción. Guarda para entrar al espacio de trabajo.
6. Edita los datos con **Guardar cambios**. Para archivar, pulsa **Archivar materia** y confirma. Sus datos siguen disponibles en el filtro **Archivadas**.

El inicio ofrece navegación a las materias. Los documentos, cuestionarios, crucigramas y estadísticas corresponden a fases posteriores. La interfaz es provisional hasta recibir referencias de Nexo.

## API principal

Base local: `http://127.0.0.1:8180`. Envía JSON y `Authorization: Bearer <token>` en las rutas privadas. El BFF de Next es el consumidor del navegador y guarda ese token en cookie HttpOnly.

| Método | Ruta | Acceso y resultado |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Público. 201 con usuario sin contraseña ni hash. |
| POST | `/api/v1/auth/login` | Público. 200 con `accessToken`, `tokenType` y `expiresAt`. |
| GET | `/api/v1/users/me` | Privado. 200 con el usuario actual. |
| POST | `/api/v1/subjects` | Privado. 201 con la materia creada. |
| GET | `/api/v1/subjects` | Privado. 200 con un array de materias propias, incluidas las archivadas. |
| GET | `/api/v1/subjects/{id}` | Privado. 200 con el detalle de una materia propia. |
| PATCH | `/api/v1/subjects/{id}` | Privado. 200 con los datos actualizados. |
| PATCH | `/api/v1/subjects/{id}/archive` | Privado. 200 con `archived: true`. Idempotente. |
| GET | `/health` | Público. 200 UP o 503 DOWN. |

Registro:

```json
{"name":"Ana Pérez","email":"ana@example.test","password":"Una contraseña de prueba larga"}
```

Login:

```json
{"email":"ana@example.test","password":"Una contraseña de prueba larga"}
```

Creación de materia:

```json
{"name":"Matemáticas","description":"Álgebra y funciones"}
```

Nombre: hasta 120 caracteres y obligatorio al crear. Descripción: opcional, hasta 2000 caracteres. PATCH conserva los campos omitidos; `{"description":null}` elimina la descripción. Un nombre `null` o vacío se rechaza. Las materias archivadas conservan sus datos y no admiten edición.

Los UUID identifican usuarios y materias. Las respuestas de materia incluyen `id`, `name`, `description`, `archived`, `createdAt` y `updatedAt`. Las fechas usan ISO 8601 UTC. El listado ordena por creación descendente y UUID para desempatar.

Los errores contienen `timestamp`, `status`, `code`, `message` y `fields`. HTTP 400 indica datos inválidos, 401 sesión ausente o inválida, 403 acceso a una materia ajena, 404 materia inexistente y 409 correo duplicado. Spring no expone entidades JPA, hashes ni detalles internos. El 403 se comprueba también al editar y archivar una materia ajena.

## Sesión y claves

`JWT_ISSUER=siare-core` y `JWT_TTL=PT30M` son los valores predeterminados. Spring valida firma, RS256, emisor, vencimiento y sujeto UUID; requiere `iat` y `exp`. El registro aplica BCrypt con coste 12. El índice UNIQUE de MySQL resuelve también registros simultáneos del mismo correo.

`jwt-keys` es un volumen Docker propio de la instancia, externo al repositorio. `Initialize-SiareKeys.ps1` crea RSA 3072 en PKCS8/SPKI PEM una sola vez. Spring lo monta en `/run/siare-keys:ro`. El script no imprime claves y falla si encuentra un par incompleto. Si ejecutas Spring fuera de Docker, configura `JWT_PUBLIC_KEY=file:/ruta/public.pem` y `JWT_PRIVATE_KEY=file:/ruta/private.pem` con un par RSA persistente externo. Conserva una copia protegida del volumen de claves junto con tus respaldos; no lo regeneres durante un reinicio normal.

En Next, `CORE_API_URL` solo se usa en servidor. `APP_ORIGIN` debe coincidir exactamente con la URL del navegador. Para el Compose local: `http://127.0.0.1:3100` y `SESSION_COOKIE_SECURE=false`. Para servir HTTPS en producción: configura el origen HTTPS y `SESSION_COOKIE_SECURE=true`; la cookie usa prefijo `__Host-`, sin Domain y con Path `/`.

El BFF aplica cookies HttpOnly y SameSite=Lax. Las mutaciones requieren origen exacto, JSON y `X-SIARE-CSRF: 1`. El cliente incluido envía esa cabecera; no necesita leer la cookie. El BFF no devuelve el access token al navegador. Cerrar sesión borra la cookie; los JWT copiados caducan al finalizar su plazo. Esta fase no incluye refresh tokens ni revocación.

## Migración y comprobaciones

`V1__users_and_subjects.sql` crea `users`, `subjects`, la restricción UNIQUE de correo, la relación de propiedad y el índice por usuario/creación. Spring Boot gestiona las versiones de Flyway; el POM añade el módulo MySQL explícito. `spring.jpa.hibernate.ddl-auto=validate` valida el resultado. La prueba real usa MySQL 8.4.13; H2 solo se usa en la suite aislada.

Desde la raíz:

```powershell
docker compose config --quiet
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-Phase1.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-Phase1.ps1 -RestartContainers
```

La segunda variante reinicia únicamente la composición SIARE y verifica con tokens previos que usuarios, materias, estado de archivo, sesiones BFF y claves persistieron. El script comprueba la identidad de los recursos antes de ejecutar Docker. Necesita Node.js 24 en el host y conserva las cuentas y materias sintéticas de prueba.

Para compilar Java con JDK 21 y ejecutar las pruebas dentro de Docker:

```powershell
docker compose build core-api
docker compose build frontend
```

El build del frontend ejecuta su suite, `next build` y `tsc --noEmit`. Para repetir el flujo de navegador en escritorio y móvil:

```powershell
Push-Location .\frontend
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd run test:e2e
Pop-Location
```

Las evidencias ejecutadas, incidencias corregidas y límites de la validación están en [VALIDATION.md](VALIDATION.md).
