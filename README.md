# SIARE académico

Sistema Inteligente de Aprendizaje y Refuerzo Educativo. La Fase 1 implementa registro, autenticación JWT RS256 y gestión de materias propias, con una interfaz funcional en Next.js y persistencia MySQL mediante Flyway.

El proyecto Spring original permanece en `services/core-api/siare-core`; su `pom.xml` conserva Java 21 y Spring Boot 4.1.2. Los contratos Abstract Factory se mantienen intactos. Consulta la [guía de Fase 1 y API](docs/PHASE1.md) y los [resultados ejecutados](docs/VALIDATION.md).

## Probar el flujo de estudiante

Con la composición iniciada, abre <http://127.0.0.1:3100/registro>, crea una cuenta e inicia sesión. Entra en **Mis materias**, selecciona **Crear materia**, indica un nombre y guarda. En el espacio de la materia puedes editar sus datos y archivarla. El filtro **Archivadas** permite consultarla después.

El registro requiere nombre, correo válido y una contraseña de al menos 10 caracteres y hasta 72 bytes UTF-8. Next.js mantiene el JWT en una cookie HttpOnly; el navegador no lo guarda en localStorage. Usa `127.0.0.1` de forma consistente: el BFF compara el origen con `APP_ORIGIN`.

## Requisitos en Windows

- Docker Desktop iniciado, con contenedores Linux y backend WSL2; Docker Compose con soporte de `up --wait`.
- Windows PowerShell 5.1 o PowerShell 7. Los scripts usan rutas relativas a su propia ubicación.
- Conexión a los registros de imágenes, Maven Central, npm y PyPI durante la primera construcción.
- Un equipo de 16 GB RAM. Se recomiendan 8 GiB para Docker/WSL2 y al menos 15 GB libres de disco para imágenes, cachés y volúmenes. La primera construcción y el arranque de Cassandra pueden tardar varios minutos.

No necesitas Java, Python o Node instalados en Windows para ejecutar la composición. Para desarrollar fuera de Docker, usa JDK 21, Python 3.12 y Node.js 24.

## Arrancar desde PowerShell

Ejecuta desde la raíz del repositorio:

```powershell
Set-Location -LiteralPath 'D:\ITP\Septimo Semestre\Programación Avanzada\siare-academico'
docker version
docker compose version
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Initialize-Siare.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Siare.ps1
```

`Initialize-Siare.ps1` crea `.env` con cinco contraseñas aleatorias independientes y una identidad local. Si el archivo ya existe, lo conserva. `.env.example` deja los secretos vacíos; Compose rechaza su ausencia. No publiques `.env` ni la salida expandida de `docker compose config`, que contiene credenciales.

`Start-Siare.ps1` valida la configuración y la identidad de los recursos, construye los servicios de uno en uno, espera hasta 900 segundos por los healthchecks y ejecuta las verificaciones. No detiene procesos ajenos para liberar puertos. Para un arranque posterior con las mismas imágenes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Siare.ps1 -SkipBuild
```

Abre <http://127.0.0.1:3100>. La API principal expone `GET http://127.0.0.1:8180/health`. Ambos puertos se vinculan solo a `127.0.0.1`.

El arranque también ejecuta `Initialize-SiareKeys.ps1`: genera una sola vez un par RSA de 3072 bits en el volumen `jwt-keys`, externo al repositorio, y conserva las claves en arranques posteriores. Spring lo monta en modo lectura. El script usa una imagen Node fijada y un contenedor temporal sin red; la composición conserva exactamente ocho servicios. No borres ese volumen: los tokens existentes dependen de esas claves.

## Verificar y detener

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-Siare.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-Phase1.ps1
# Opcional: prueba de persistencia que reinicia exclusivamente los ocho contenedores SIARE.
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-Phase1.ps1 -RestartContainers
docker compose --env-file .env config --quiet
docker compose --env-file .env ps
docker compose --env-file .env logs --tail 80 core-api content-ai progress-api frontend
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Stop-Siare.ps1
```

`Test-Siare.ps1` exige los ocho servicios `healthy`, vuelve a ejecutar las consultas de las cuatro bases de datos, consulta los tres backends y comprueba tanto la página como `frontend -> servidor Next.js -> Spring`. También revisa que solo estén publicados los puertos 3100 y 8180 en loopback. `Test-Phase1.ps1` necesita Node.js 24 en el host y crea cuentas sintéticas `@example.test` para comprobar la API, el BFF y CSRF, sin eliminar datos. Un fallo termina el script con error.

Para retirar exclusivamente los contenedores y las redes de esta instancia, conservando todos sus volúmenes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Stop-Siare.ps1 -RemoveContainers
```

No ejecutes `docker compose down -v`, `docker system prune` ni comandos globales de limpieza. La detención normal mantiene los volúmenes y permite volver a arrancar.

## Servicios y versiones

Las imágenes externas tienen versión completa y digest SHA-256 en los Dockerfiles y en `compose.yaml`. npm conserva archivos `package-lock.json` para `npm ci`; Python usa `requirements.lock` con las dependencias transitivas fijadas. Las dependencias Maven las gestiona el BOM del proyecto existente.

| Servicio DNS | Tecnología fijada | Puerto interno | Acceso desde Windows |
| --- | --- | --- | --- |
| `core-api` | Java 21.0.13+9, Spring Boot 4.1.2, Spring Security 7 gestionado por Boot | 8080 | `127.0.0.1:8180` |
| `content-ai` | Python 3.12.16, Flask 3.1.3, Gunicorn 26.2.0 | 5000 | Sin publicación |
| `progress-api` | Node.js 24.22.2, Express 5.3.0, TypeScript 5.9.3 | 3001 | Sin publicación |
| `frontend` | Node.js 24.22.2, Next.js 16.4.6, React 19.3.1, Tailwind 4.3.5 | 3000 | `127.0.0.1:3100` |
| `mysql` | MySQL 8.4.13 LTS | 3306 | Sin publicación |
| `mongo` | MongoDB 8.0.34 | 27017 | Sin publicación |
| `cassandra` | Cassandra 4.1.12 | 9042 | Sin publicación |
| `redis` | Redis 7.4.12 | 6379 | Sin publicación |

Dentro de Docker se usan los nombres DNS de la tabla. `localhost` dentro de un contenedor identifica ese contenedor, no Windows ni otra base de datos. `CORE_API_URL=http://core-api:8080` se utiliza únicamente en el servidor Next.js, sin prefijo `NEXT_PUBLIC_` y sin CORS abierto.

La red `data` es interna y aloja las bases de datos, Flask, Express y Spring. La red `edge` conecta Next.js con Spring y permite publicar sus dos puertos. Los volúmenes `mysql-data`, `mongo-data`, `mongo-config`, `cassandra-data`, `redis-data` y `jwt-keys` pertenecen al proyecto, sin directorios de datos de Windows o WSL montados.

## Estructura

```text
siare-academico/
  compose.yaml
  .env.example
  .gitignore
  .gitattributes
  README.md
  docs/
    ARCHITECTURE.md
    PHASE1.md
    VALIDATION.md
  scripts/
    Initialize-Siare.ps1
    Initialize-SiareKeys.ps1
    Common.ps1
    Start-Siare.ps1
    Stop-Siare.ps1
    Test-Siare.ps1
    Test-Phase1.ps1
    test-phase1.mjs
  docker/
    mongo/10-app-user.js
    cassandra/entrypoint.sh
  services/
    core-api/siare-core/
      pom.xml                  # proyecto original conservado
      Dockerfile
      docker/Healthcheck.java
      src/main/java/com/siare/core/
        SiareCoreApplication.java
        domain/
          health/
          activity/
            factory/
            quiz/
            crossword/
        application/
          port/in/
          port/out/
          service/
        infrastructure/
          adapter/in/web/
          adapter/out/
          config/
      src/main/resources/application.properties
      src/test/
    content-ai/
      Dockerfile
      requirements.txt
      requirements.lock
      wsgi.py
      app/{models,controllers,views}/
      tests/
    progress-api/
      Dockerfile
      package.json
      package-lock.json
      tsconfig.json
      src/{models,controllers,views,routes}/
      src/{app,server}.ts
      test/
  frontend/
    Dockerfile
    package.json
    package-lock.json
    next.config.ts
    postcss.config.mjs
    tsconfig.json
    src/app/{login,registro,(student)/inicio,(student)/materias,api/bff,api/health}/
    src/components/           # formularios, navegación, listado y espacio de materia
    src/lib/                  # salud, cliente API, sesión de servidor y política CSRF
    tests/                    # pruebas aisladas y e2e con Playwright
    playwright.config.ts
```

## Salud y seguridad de esta fase

Spring permite de forma anónima `GET /health`, `POST /api/v1/auth/register` y `POST /api/v1/auth/login`. La salud devuelve `{"status":"UP"}` o `{"status":"DOWN"}` y HTTP 200 o 503 según JDBC y MongoDB. Spring Security 7 valida la firma RS256, emisor, expiración y sujeto UUID para las rutas privadas. Actuator queda denegado incluso con token. El dominio y la aplicación no importan Spring.

La API usa exclusivamente `Authorization: Bearer`; no autentica cookies y mantiene sesiones stateless. Next.js guarda el token en cookie HttpOnly, `SameSite=Lax` y `Secure` en producción. El BFF exige origen exacto, JSON y cabecera `X-SIARE-CSRF` en las mutaciones. `SESSION_COOKIE_SECURE=false` corresponde al HTTP local del Compose; en HTTPS de producción debe ser `true`. El plazo por defecto es 30 minutos (`JWT_TTL=PT30M`) y el emisor `siare-core` (`JWT_ISSUER`).

Flask comprueba MongoDB con el usuario de aplicación y Redis con contraseña; Express consulta `system.local` de Cassandra. Sus endpoints devuelven solo servicio y estado. Los errores no devuelven cadenas de conexión. Los healthchecks se ejecutan dentro de los contenedores y `depends_on` espera a que las dependencias estén `healthy` durante el arranque. Esto no sustituye la recuperación de conexiones después de una caída.

Flyway crea `users` y `subjects` en MySQL mediante `V1__users_and_subjects.sql`; Hibernate valida el esquema con `ddl-auto=validate`. El correo tiene una restricción UNIQUE y las materias una clave foránea a su propietario. Las fechas usan UTC. MongoDB conserva su usuario limitado; GridFS y los esquemas de contenido/progreso siguen pendientes. Redis conserva AOF. Cassandra usa un nodo sin autenticación, accesible únicamente desde la red interna de desarrollo. El Compose sigue siendo local: el despliegue de producción necesita TLS, secretos administrados, roles de Cassandra y copias de seguridad.

Los usuarios y materias se guardan en MySQL. MongoDB se reserva para documentos y contenidos; Cassandra para intentos y eventos; Redis para caché. La Fase 1 no implementa ML ni actividades educativas.

## Memoria y equipo de 16 GB

| Servicio | Límite de memoria | Ajuste principal |
| --- | --- | --- |
| Cassandra | 2560 MiB | Heap 768 MiB; young generation 192 MiB; dos CPU visibles |
| MySQL | 640 MiB | Buffer pool 192 MiB; 40 conexiones |
| MongoDB | 768 MiB | Caché WiredTiger 0,25 GiB |
| Redis | 192 MiB | `maxmemory` 96 MiB; política `allkeys-lru` |
| Spring | 768 MiB | Heap máximo 384 MiB; metaspace 192 MiB; pool JDBC de cinco |
| Flask | 256 MiB | Un worker Gunicorn y dos threads |
| Express | 256 MiB | Heap V8 128 MiB; una conexión local a Cassandra |
| Next.js | 384 MiB | Heap V8 256 MiB; build con un worker |

Los límites suman 5824 MiB (5,69 GiB); no son reservas ni una medición de consumo. Docker, el kernel de WSL2 y la construcción necesitan margen adicional. Con 8 GiB para Docker quedan aproximadamente 8 GB para Windows, VS Code y otras aplicaciones. No construyas varios proyectos pesados a la vez.

Cassandra dispone de memtables de 128 MiB en heap y 64 MiB fuera de heap, caché de archivos de 64 MiB, un compactor y concurrencias de lectura/escritura de dos. Los valores están pensados para desarrollo universitario con poca carga. El healthcheck concede tres minutos iniciales y reintentos; el script espera hasta quince minutos. No configures un clúster de tres nodos en este equipo para esta fase.

Si decides limitar WSL2 mediante `%UserProfile%\.wslconfig`, una referencia es `memory=8GB`, `processors=4`, `swap=2GB` en la sección `[wsl2]`. Es un ajuste global que afecta a todas tus distribuciones: los scripts SIARE no escriben ese archivo ni ejecutan `wsl --shutdown`.

## Convivencia con otros proyectos y servicios de Windows/WSL2

No hay `container_name`, redes externas, volúmenes externos, puertos de bases de datos publicados ni enlaces a servicios instalados en el host. MongoDB o Cassandra locales pueden conservar sus puertos y directorios. El nombre Compose prefija contenedores, redes, imágenes de aplicación y volúmenes.

Los scripts comprueban `io.siare.instance` en todos los recursos del nombre Compose antes de arrancar o detener. Si encuentran otra identidad, se niegan a modificarla. Conserva `.env` mientras uses esos volúmenes: regenerar la identidad o cambiar las contraseñas no actualiza automáticamente una base ya inicializada.

Para una segunda copia independiente, inicialízala con otro nombre antes de crear su `.env`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Initialize-Siare.ps1 -ProjectName siare-daniel
```

Las dos copias aún compiten por 3100 y 8180; no las ejecutes simultáneamente con este archivo Compose. Comprueba los puertos ocupados sin detener nada:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3100,8180 -ErrorAction SilentlyContinue
docker context show
docker compose ls
```

Si `docker version` no muestra servidor, inicia Docker Desktop y espera a que esté listo. Si aparece `access denied` sobre el pipe Docker, revisa los permisos de tu sesión de Docker Desktop. Ejecuta los comandos desde un contexto Docker Linux que tengas autorizado.

## Pruebas sin Docker

```powershell
# JDK 21 y Maven Wrapper existente; no usa bases de datos externas durante los tests.
Push-Location .\services\core-api\siare-core
.\mvnw.cmd -B -ntp verify
Pop-Location

# Python 3.12; el entorno virtual se crea dentro del repositorio.
Push-Location .\services\content-ai
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
Pop-Location

# Node.js 24
Push-Location .\services\progress-api
npm.cmd ci
npm.cmd test
Pop-Location

Push-Location .\frontend
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd run typecheck
Pop-Location
```

El perfil `test` de Spring usa H2 en modo MySQL, ejecuta Flyway y la cadena real de seguridad con claves RSA efímeras exclusivas de pruebas. No sustituye la comprobación en MySQL 8.4 de `Test-Phase1.ps1`. El build Java Docker ejecuta Maven `verify` con JDK 21; el de Next ejecuta pruebas, build y TypeScript.

Para las pruebas de navegador, con la composición iniciada:

```powershell
Push-Location .\frontend
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd run test:e2e
Pop-Location
```

Playwright prueba el flujo en 1440 y 375 píxeles, con movimiento reducido en móvil. Crea datos sintéticos y guarda capturas en `.cache/`. Si ya dispones de Chromium compatible, puedes indicar su ejecutable con `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Para ejecutar Next fuera de Docker y consultar la API de la composición:

```powershell
Push-Location .\frontend
$env:CORE_API_URL = 'http://127.0.0.1:8180'
$env:APP_ORIGIN = 'http://127.0.0.1:3100'
$env:SESSION_COOKIE_SECURE = 'false'
npm.cmd run dev
Pop-Location
```

No ejecutes ese servidor a la vez que el frontend Docker en el puerto 3100. Gunicorn se utiliza en Linux/Docker; para depurar Flask en Windows usa `python -m flask --app wsgi run` y configura primero las variables de conexión. Las bases de la composición no tienen puertos host: ejecuta los clientes desde los contenedores para mantener el aislamiento.

## Próximos pasos

1. Recibir capturas o especificaciones de Nexo antes de adaptar la identidad visual.
2. Diseñar repositorios MongoDB/GridFS y el modelo de particionado Cassandra para las siguientes fases.
3. Desarrollar Quiz y Crossword con sus productos Abstract Factory durante la fase de actividades.

Las decisiones de dependencia y las fuentes oficiales consultadas están en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
