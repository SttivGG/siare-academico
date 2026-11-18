# Incorporación al desarrollo móvil

Esta guía prepara el trabajo en `mobile/`; todavía no existe implementación React Native. Lee primero el [contrato HTTP](CONTRATO_API_MOBILE.md) y la [guía de colaboración](GUIA_COLABORACION.md). El contrato completo versionado está en [openapi.json](openapi.json).

El integrante 2 trabajará con React Native, Expo y TypeScript en `feature/mobile-react-native`, creada desde `main` actualizado. Su alcance incluye pantallas/navegación Android, login/MFA, sesiones seguras, materias/documentos, consumo de API y APK instalable con prueba en dispositivo. Debe respetar la guía visual definida por el integrante 1 y someterle la revisión de diseño e integración; no modifica `frontend/`. Consulta [roles](EQUIPO_ROLES.md) y [contratos del equipo](CONTRATOS_EQUIPO.md) para las dependencias con ML y progreso.

Antes de crear Expo en la fase de desarrollo, acuerda con el líder navegación, componentes y estados de error/carga; prepara Android SDK, dispositivo y HTTPS confiable. Después implementa login local/MFA y materias/documentos sobre las API existentes. Las pantallas de actividades, progreso y recomendaciones dependerán de contratos públicos Spring futuros; no llames a Python/Express desde Android. Registra versión de herramientas, pruebas del módulo y procedimiento de construcción/instalación del APK en tus PR. Esta actividad no inicializa el proyecto móvil ni genera un APK.

## Arquitectura y directorios

SIARE usa nueve servicios. Spring es la autoridad de usuarios, permisos, sesiones, materias y documentos. Next.js sirve la web y su BFF. Flask extrae contenido documental. Express expone salud de Cassandra; todavía no ofrece una API pública de progreso académico. El cliente móvil consumirá Spring directamente con Bearer.

| Directorio o archivo | Responsabilidad |
| --- | --- |
| `services/core-api/siare-core/` | Java 21, Spring Boot, arquitectura de dominio/aplicación/adaptadores, Flyway |
| `services/content-ai/` | Python 3.12, Flask, extracción PDF/Office/OCR; API interna |
| `services/progress-api/` | Node 24, Express y TypeScript; conexión Cassandra |
| `frontend/` | Next.js, BFF web y pruebas Playwright |
| `compose.datos.yml` | MySQL, MongoDB, Cassandra, Redis y ClickHouse |
| `compose.apps.yml` | Spring, Flask, Express y Next.js |
| `scripts/` | Inicialización, arranque, copias, pruebas y comprobación de identidad |
| `docs/` | Contratos, arquitectura y evidencias históricas por fase |
| `mobile/` | Directorio previsto para el compañero; no creado en esta consolidación |

MySQL conserva usuarios, roles, ámbitos, sesiones, refresh, MFA e identidades externas. MongoDB conserva originales GridFS, metadatos y texto. Redis contiene caché y flujos OIDC efímeros. Cassandra y ClickHouse están preparados para progreso y analítica; su salud no acredita funcionalidades académicas futuras.

## Arranque con Docker

Requisitos: Docker Desktop con contenedores Linux/WSL2, Compose, PowerShell y memoria suficiente. Para una instalación completamente nueva:

```powershell
git clone https://github.com/SttivGG/siare-academico.git
cd siare-academico
git switch main
./scripts/Initialize-Siare.ps1
./scripts/Initialize-SiareInfrastructure.ps1 -NewInstallation
./scripts/Initialize-H2B1.ps1 -FirstProvision
./scripts/Start-Siare.ps1
```

`-NewInstallation` y `-FirstProvision` se usan exclusivamente cuando no existen datos ni factores previos. En una instalación existente, conserva `.env`, la identidad de instancia y la clave AES externa; no repitas el aprovisionamiento. Una instalación antigua de Fase 2 requiere [migración H1](MIGRACION_H1.md). Arranques posteriores: `./scripts/Start-Siare.ps1 -SkipBuild`.

Verifica con `./scripts/Test-Siare.ps1`. Para detener conservando datos usa `./scripts/Stop-Siare.ps1`. No borres volúmenes, no uses `down -v` y no regeneres claves. Los siete volúmenes externos son `mysql-data`, `mongo-data`, `mongo-config`, `cassandra-data`, `redis-data`, `clickhouse-data` y `jwt-keys`, prefijados por el proyecto. La clave AES TOTP está fuera del repositorio y se monta en solo lectura; requiere un respaldo protegido independiente.

| Servicio | Puerto interno | Acceso predeterminado desde el PC |
| --- | --- | --- |
| Spring `core-api` | 8080 | `127.0.0.1:8180` |
| Next `frontend` | 3000 | `127.0.0.1:3100` |
| Flask `content-ai` | 5000 | Solo red Docker |
| Express `progress-api` | 3001 | Solo red Docker |
| MySQL / Mongo / Cassandra / Redis | 3306 / 27017 / 9042 / 6379 | Solo red Docker |
| ClickHouse | 8123 / 9000 | Solo red Docker |

No uses `docker compose up` sin los dos archivos: `compose.yaml` contiene una guarda deliberada. Para consultar configuración sin imprimir secretos:

```powershell
docker compose -f compose.datos.yml -f compose.apps.yml --env-file .env config --quiet
docker compose -f compose.datos.yml -f compose.apps.yml --env-file .env ps
```

## Variables y ejecución de servicios

`.env.example` deja vacías las credenciales. Cada desarrollador genera su `.env` mediante el inicializador y configura los proveedores externamente, sin copiar el archivo de otro compañero. No publiques configuración Compose expandida, contraseñas, tokens, semillas MFA, archivos RSA, claves AES ni respaldos. Las variables `GOOGLE_*`, `GITLAB_*`, SMTP, `CONTENT_SERVICE_TOKEN` y contraseñas de datos pertenecen al backend; ninguna debe incorporarse al APK. La aplicación móvil solo necesita la URL pública de la API como configuración distribuible.

Para levantar cada aplicación dentro de la instalación ya aprovisionada:

```powershell
docker compose -f compose.datos.yml -f compose.apps.yml --env-file .env up -d --wait mysql mongo redis cassandra clickhouse
docker compose -f compose.datos.yml -f compose.apps.yml --env-file .env up -d --wait content-ai progress-api core-api frontend
```

El flujo recomendado conserva las bases sin puertos publicados. Si desarrollas procesos en el host, necesitas una configuración local aislada y acceso explícito a sus dependencias; los nombres DNS Docker no resuelven desde Windows. No publiques las bases para resolverlo. Estos son los comandos de proceso, una vez suministradas variables seguras y conectividad apropiada:

```powershell
# Spring, JDK 21; desde services/core-api/siare-core
./mvnw.cmd spring-boot:run
# Flask, Python 3.12; desde services/content-ai
py -3.12 -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.lock
./.venv/Scripts/python.exe -m flask --app wsgi:app run --host 127.0.0.1 --port 5000
# Express, Node 24; desde services/progress-api
npm ci
npm run dev
# Next.js; desde frontend
npm ci
npm run dev
```

Spring requiere `MYSQL_DATABASE/USER/PASSWORD`, `MONGO_DATABASE/USER/PASSWORD`, `CONTENT_SERVICE_TOKEN` y las rutas de claves. En el host configura además `MYSQL_HOST/PORT`, `MONGO_HOST/PORT`, `REDIS_HOST/PORT`, `CONTENT_AI_URL`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` y `SIARE_MFA_KEY_FILE` con recursos accesibles y existentes. Flask requiere variables Mongo/Redis y su token interno; Express necesita Cassandra y opcionalmente ClickHouse según el modelo. Consulta `compose.apps.yml` como lista exacta. No cambies migraciones V1–V4 aplicadas ni uses un perfil de pruebas contra datos reales.

## Android: conectividad y TLS

En un emulador, `127.0.0.1` identifica Android. El alias habitual del host en Android Emulator es `10.0.2.2`; no corresponde al teléfono físico. Para acceder a los puertos que Compose limita al loopback del PC, se puede usar ADB en ambos tipos de dispositivo:

```powershell
adb devices
adb -s SERIAL reverse tcp:8180 tcp:8180
adb -s SERIAL reverse --list
# Cuando se use Metro, también se necesitará su puerto según el proyecto móvil.
```

El reenvío permite que `127.0.0.1:8180` del dispositivo llegue al PC conectado. El Compose actual sirve HTTP de desarrollo: ADB no lo convierte en HTTPS. Antes de enviar credenciales desde una app que exija TLS, prepara un proxy HTTPS local con certificado confiable, reenvía su puerto y utiliza un nombre que coincida con el certificado. Mantén verificaciones de certificados y hostname. Para un teléfono por Wi-Fi, necesita una URL HTTPS accesible y firewall limitado; no uses `127.0.0.1` ni `10.0.2.2` como dirección del PC. No abras bases de datos, no habilites cleartext global y no uses gestores TLS permisivos.

La configuración del proxy/certificados para móvil aún debe acordarse; no se entrega como parte del Compose local. Referencias oficiales: [direcciones del emulador](https://developer.android.com/studio/run/emulator-networking-address) y [ADB](https://developer.android.com/tools/adb).

## Pruebas y datos

Las suites HTTP crean cuentas sintéticas `@example.test`, materias y documentos y los conservan. No usan datos productivos ni necesitan credenciales OAuth reales. No ejecutes suites HTTP simultáneamente: comparten límites de autenticación.

```powershell
./scripts/Test-Siare.ps1
./scripts/Test-Phase1.ps1
./scripts/Test-H2A.ps1
./scripts/Test-H2B1.ps1
./scripts/Test-H2B2.ps1
./scripts/Test-Phase2.ps1
```

Desde Spring: `./mvnw.cmd -B -ntp verify` (H2 aislado; excluye `real-stores`). Desde frontend: `npm test`, `npm run build`, `npm run typecheck`, `node --test tests/integration/oidc-bff.mjs` y `npm run test:e2e` con el stack listo. Desde Express: `npm test`. Desde Flask: `python -m unittest discover -s tests -v`; la imagen permite `SIARE_REAL_OCR=1` con Tesseract español instalado. `Test-H2B2.ps1` usa MySQL/Redis reales y un proveedor OIDC controlado: no es login real Google/GitLab.

Los resultados y límites de la consolidación se registran en [CONSOLIDACION_MAIN.md](CONSOLIDACION_MAIN.md). Las evidencias del 11 y 18 de noviembre corresponden a las ejecuciones allí documentadas; esta preparación de equipo no las vuelve a ejecutar. El usuario reportó validación manual exitosa de GitLab OIDC el 18/11/2026: [registro y alcance](H2B2_GITLAB_REAL.md). Se distingue de las pruebas automatizadas y no acredita OIDC nativo.
