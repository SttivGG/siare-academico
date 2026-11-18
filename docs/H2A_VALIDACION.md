# Validación H2-A

Fecha local: 10/11/2026 (America/Bogota). Rama `feature/h2a-roles-sesiones`.
Las evidencias locales se guardan en `.cache/`; los respaldos privados, en
`.local/backups/`. Ambos directorios permanecen fuera de Git.

## Preservación

Antes de migrar se capturaron huellas lógicas de todos los registros de usuarios
y materias, las colecciones MongoDB de documentos/fragmentos/GridFS, RSA,
montajes y `.env`. Después de Flyway V2, las cinco comparaciones coincidieron:
67 usuarios y 42 materias anteriores conservados, sin cambios en sus filas.
Esta comparación se hizo antes de pruebas que crean datos sintéticos o migran
un hash tras un login válido.

El respaldo frío verificado está en
`.local/backups/20261110-204109-aa047e6a`, con manifiesto y archivos de los siete
volúmenes: MySQL, MongoDB datos/config, Cassandra, Redis, RSA y ClickHouse.
No se borraron volúmenes, no se regeneró RSA y no se modificó `.env`. Los dos
Compose y la red externa siguen activos. Solo se operó sobre la instancia SIARE.

## Suites y recursos

| Validación | Resultado/evidencia |
| --- | --- |
| Backend en imagen Java 21 | 50 pruebas, sin fallos ni omisiones; `.cache/h2a-core-build.log` |
| Backend final en host Java 21 | 52 pruebas, sin fallos; incluye bootstrap idempotente y rechazo sin TTY; `.cache/h2a-java.log` |
| JWT anterior todavía vigente | 14 pruebas Fase 1 repetidas; se firma un JWT RS256 con usuario existente, emisor/jti/tiempos válidos y sin sid, que recibe 401; `.cache/h2a-legacy-token-test.log` |
| Next.js | 15 unitarias, build y TypeScript; `.cache/h2a-frontend-docker.log` |
| Flask en host | 13 pruebas: 12 pasan, una omisión explícita de OCR real reservado a Docker |
| Flask en Docker, `SIARE_REAL_OCR=1` | 13 pruebas correctas, sin omisiones, incluido Tesseract real; `.cache/h2a-python-real.log` |
| Express | Tres pruebas correctas y compilación TypeScript |
| OpenAPI | JSON parseable y referencias internas resueltas; 25 rutas, 30 operaciones |
| Arranque H2-A | Nueve servicios saludables; `.cache/h2a-start.log` |

La construcción final midió Argon2id con `m=19456 KiB,t=2,p=1`: mediana 55 ms y
máximo 71 ms, siete muestras después de calentamiento. El semáforo limita a dos
operaciones simultáneas, unos 38 MiB de memoria de trabajo Argon2. No es una
prueba de carga ni un percentil de producción. No se aumentaron límites de RAM.

Antes del cambio, `docker stats --no-stream` mostró Spring 389,8 MiB/768 MiB,
Next 122,6/384 MiB, MySQL 234/640 MiB, Mongo 216,1/768 MiB, Cassandra
1,107 GiB/2,5 GiB, Redis 19,84/192 MiB, Flask 101,4/256 MiB, Express
60,37/256 MiB y ClickHouse 433,1 MiB/1 GiB. Son muestras, no reservas.

Después de los flujos HTTP/navegador, Spring usó 415,4 MiB/768 MiB y Next
96,98/384 MiB. Evidencia: `.cache/h2a-memory-after.log`. Los límites no cambiaron.

## Criterios obligatorios

| # | Criterio | Evidencia |
| --- | --- | --- |
| 1 | Usuarios previos conservados | Huellas antes/después de 67 usuarios y 42 materias; prueba aislada V1 a V2 |
| 2 | Registro siempre USER | `IdentityApiTests`: rechazo de inyección y comprobación de asignación |
| 3 | Contraseñas débiles bloqueadas | Casos cortos, comunes y exceso de longitud |
| 4 | Frases largas aceptadas | Registro Unicode largo y login con forma NFD equivalente |
| 5 | BCrypt anterior | Login de clave previa corta, UUID conservado y rehash sin nueva política mínima |
| 6 | Argon2id | Prefijo/parámetros, verificación y medición de siete muestras |
| 7 | Correo único | `PhaseOneApiTests` y restricción MySQL existente |
| 8 | Intentos abusivos | Cinco fallos y sexto intento 429; contador duradero MySQL |
| 9 | Access/refresh | Campos, RS256, sid/jti y secreto opaco de 43 caracteres |
| 10 | Rotación | Refresh sucesor diferente y solo huella persistida |
| 11 | Reutilización | 401 y revocación de toda la sesión; evento REFRESH_REUSE |
| 12 | Logout real | Revocación en backend antes de borrar cookies |
| 13 | JWT revocado | API rechaza JWT firmado y no expirado de sesión revocada |
| 14 | Inactividad/absoluta | Relojes controlados, actividad intermedia y caducidad final |
| 15 | Renovación concurrente | Dos hilos; resultados 200/401 y sesión revocada; lectura bloqueante MySQL |
| 16 | USER sin administración | Denegaciones de overview/usuarios/ámbitos/auditoría en API |
| 17 | ADMIN sin SUPERADMIN | Política controlada: no asigna SUPERADMIN ni modifica SUPERADMIN |
| 18 | ADMIN limitado al ámbito | Listado filtrado y rechazo de escritura fuera de ámbito; habilita USER propio |
| 19 | SUPERADMIN definido | Política controlada: ámbitos, asignaciones, auditoría y parámetro; no automodificación |
| 20 | Objetos propios | Regresiones de materias/documentos de Fases 1/2 |
| 21 | Objetos ajenos | API niega leer/editar/archivar, listar/subir/descargar/procesar/texto ajenos; sesión ajena 404 |
| 22 | Auditoría crítica | Cambios de asignación, denegaciones, revocación y reutilización comprobados |
| 23 | Persistencia | Prueba HTTP con reinicio de los nueve servicios, registrada abajo |
| 24 | Regresión Fases 1/2 | Suites unitarias, scripts reales y Playwright, registrados abajo |
| 25 | Nueve saludables | Arranque y `Test-Siare.ps1`, registrados abajo |

## Incidencias corregidas

- La lectura de refresh ahora usa `FOR UPDATE`; una lectura de snapshot con
  REPEATABLE READ podía observar un `consumed_at` anterior.
- El validador compara el claim `iss` como texto. El emisor existente
  `siare-core` no es una URL y no debe interpretarse como tal.
- La prueba del límite de sesiones comprueba cantidad activa y revocada; con
  reloj fijo, varias sesiones tienen la misma fecha y no existe una primera
  sesión estrictamente más antigua.
- La prueba de reinicio cierra conexiones HTTP entre peticiones para evitar
  reutilizar un socket que Docker cerró. No reintenta refresh ambiguos.
- La comprobación SQL de Fase 1 acepta BCrypt previo y Argon2id nuevo. La
  descarga conserva su contenido/nombre y ahora usa un botón para poder renovar
  sesión antes de descargar.
- El rechazo de cargas ligeramente sobredimensionadas consume un exceso de
  hasta 2 MiB, descartándolo antes de responder 413. Evita un ECONNRESET que
  también figuraba en una ejecución H1. Tres pruebas comprueban el drenaje,
  cancelación al superar el presupuesto y conservación de cargas válidas.

## Alcance pendiente

ADMIN/SUPERADMIN permanecen bloqueados en el runtime. Sus operaciones positivas
se prueban en objetos de aplicación con política controlada; no se habilitó un
panel privilegiado sin MFA. El bootstrap interactivo no se ha ejecutado con una
cuenta privilegiada real. El corpus local no representa todas las filtraciones.
La prueba no acredita carga sostenida, TLS ni auditoría inmutable frente al DBA.

OIDC, MFA y recuperación de cuenta quedan para H2-B. APK queda para el frente
móvil. El inventario de cambios y el contrato están en [H2A_IDENTIDAD.md](H2A_IDENTIDAD.md)
y [openapi.json](openapi.json).

## Pruebas HTTP y navegador

`Test-H2A.ps1 -RestartContainers` completó 46 verificaciones HTTP y después
`Test-Siare.ps1`: nueve servicios saludables, consultas autenticadas a los cinco
motores, tres backends, puertos restringidos y BFF. Se comprobó que una sesión
válida sobrevive al reinicio, una revocada sigue rechazada y los JWT anteriores
sin sesión requieren login. Evidencia: `.cache/h2a-live.log`.

`Test-Phase1.ps1` completó 31 comprobaciones HTTP y la verificación general de
salud. La aserción anterior de 1800 segundos se sustituyó por un access positivo
de hasta 900 segundos, coherente con la nueva configuración. Evidencia:
`.cache/h2a-phase1.log`.

`Test-Phase2.ps1 -SimulatePythonOutage` completó 173 comprobaciones HTTP de los seis
formatos, texto, descarga, propiedad, entradas inválidas, límites JSON/multipart
y la caída/recuperación de Flask. La ejecución final devolvió 413 en cargas
sobredimensionadas con Content-Length y con transferencia por chunks. El
original se conservó ante la caída y el reintento recuperó el procesamiento.
Después, la comprobación general confirmó nueve servicios saludables. Evidencia:
`.cache/h2a-phase2.log`.

Playwright completó ocho pruebas en Chrome: cuatro en 1440 px y cuatro en
375 px con movimiento reducido. Incluyen Fases 1/2, renovación con cookie
HttpOnly al desaparecer el access, denegación administrativa en backend, cierre
de otras sesiones, CSRF, extracción y descarga del original. Evidencia:
`.cache/h2a-browser.log`; capturas `.cache/h2a-sessions-desktop.png` y
`.cache/h2a-sessions-mobile.png`, revisadas visualmente.

Tras corregir el rechazo de cargas se repitieron los dos flujos Playwright de
documentos, en escritorio y móvil: ambos pasan. Evidencia:
`.cache/h2a-browser-documents-final.log`.
