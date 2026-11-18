# Migración y recuperación H1

La migración conserva `COMPOSE_PROJECT_NAME`, `SIARE_INSTANCE_ID`, todas las
credenciales previas, imágenes de aplicación, puertos loopback 3100/8180 y claves
RSA. El commit de recuperación de Fase 2 es
`2d7aa04d739f8f65245d25f2201ec033382b1bbe`.

## Recursos y ciclo de vida

`compose.datos.yml` contiene MySQL 8.4, MongoDB 8.0, Cassandra 4.1, Redis 7.4 y
ClickHouse 26.8.36.3 LTS fijado también por digest. `compose.apps.yml` contiene
Spring, Flask, Express y Next.js. Ambos son válidos por separado. Los scripts
cargan los dos con el mismo nombre de proyecto y levantan primero datos y luego
aplicaciones; así conservan la espera de salud sin dependencias entre archivos
que invaliden el Compose de aplicaciones por separado. Next depende de Spring.
No uses `--remove-orphans` al operar uno de los archivos por separado.

La red externa compartida es `${COMPOSE_PROJECT_NAME}_data`. Ya existía como
bridge con `internal=true` y se reutiliza. «Externa» describe quién administra su
ciclo de vida; `internal=true` mantiene el aislamiento. El inicializador verifica
etiquetas de propiedad y la crea solo si falta. La red edge sigue conectando
Next y Spring. Ninguna base publica puertos en Windows.

| Volumen real en esta instalación | Montaje | Tratamiento |
| --- | --- | --- |
| siare-academico_mysql-data | /var/lib/mysql | Externo, existente obligatorio |
| siare-academico_mongo-data | /data/db | Externo, existente obligatorio |
| siare-academico_mongo-config | /data/configdb | Externo, existente obligatorio |
| siare-academico_cassandra-data | /var/lib/cassandra | Externo, existente obligatorio |
| siare-academico_redis-data | /data | Externo, existente obligatorio |
| siare-academico_jwt-keys | /run/siare-keys, solo lectura en Spring | Externo, existente obligatorio |
| siare-academico_clickhouse-data | /var/lib/clickhouse | Nuevo, creado con etiquetas de instancia |

Los contenedores conservan el patrón `siare-academico-<servicio>-1`. Docker
Compose detiene el contenedor anterior antes de recrear el servidor que monta su
volumen. El procedimiento no levanta un segundo servidor contra un mismo volumen.

## Migrar una instalación de Fase 2

Ejecuta desde la raíz con Docker Desktop disponible. Se necesita espacio para
copias comprimidas de todos los volúmenes. Cierra las pruebas que escriben datos
y reserva una ventana sin usuarios. No se modifica la configuración de WSL.

```powershell
git branch --show-current
git status --short
node scripts/test-h1-continuity.mjs --prepare
./scripts/Get-SiarePersistence.ps1 -OutputPath .cache/h1-before.json
./scripts/Migrate-Siare.ps1 -SkipBuild
./scripts/Get-SiarePersistence.ps1 -OutputPath .cache/h1-after.json
node scripts/test-h1-continuity.mjs
./scripts/Test-Phase1.ps1
./scripts/Test-Phase2.ps1 -SimulatePythonOutage -RestartContainers
```

El fixture de continuidad requiere los fixtures de Test-Phase2 existentes. La
migración inicializa únicamente las variables nuevas de ClickHouse, valida ambos
archivos, detiene solo SIARE y genera un respaldo en `.local/backups/<fecha-id>`.
Monta los volúmenes en lectura en un contenedor temporal sin red, verifica que
cada tar comprimido pueda leerse y guarda tamaños/SHA-256 en `manifest.json`.
Incluye `.env`, RSA y el Compose anterior. Una copia incompleta impide migrar y
deja los servicios detenidos para evitar agravar el problema.

Una vez completo el respaldo, registra `.local/migration-h1.json`, prepara red y
volumen nuevo, conserva los seis volúmenes previos y arranca los nueve servicios.
`Start-Siare.ps1` rechaza una instancia de Fase 2 sin ese paso de respaldo.
`-SkipBuild` reutiliza las imágenes existentes de Fase 2, suficientes para H1.
Sin ese modificador, construye las cuatro aplicaciones secuencialmente.

Los respaldos contienen contraseñas, datos y claves privadas. `.local` está
ignorado por Git; restringe el acceso a esa carpeta y copia el respaldo a un
medio privado fuera del equipo. Una copia local no protege contra pérdida del
disco. No publiques archivos `.env`, tar ni salidas expandidas de Compose.

## Instalación nueva y operación normal

```powershell
./scripts/Initialize-Siare.ps1 -ProjectName siare-nuevo
./scripts/Initialize-SiareInfrastructure.ps1 -NewInstallation
./scripts/Start-Siare.ps1
./scripts/Test-Siare.ps1
./scripts/Stop-Siare.ps1
./scripts/Start-Siare.ps1 -SkipBuild
```

`-NewInstallation` solo acepta un proyecto sin volúmenes ni contenedores previos.
En instalaciones existentes, la ausencia de un volumen antiguo detiene el
arranque; el script no lo reemplaza por uno vacío. La preparación RSA tampoco
crea un volumen ausente. Un par incompleto exige recuperar el respaldo.

Para inspecciones manuales añade siempre ambos archivos:

```powershell
docker compose -f compose.datos.yml -f compose.apps.yml config --quiet
docker compose -f compose.datos.yml -f compose.apps.yml ps
```

La detención para aplicaciones antes de datos. `Stop-Siare.ps1 -RemoveContainers`
retira solo los contenedores declarados y conserva redes y volúmenes externos.
No ejecutes limpieza global ni elimines volúmenes.

## Volver al despliegue de Fase 2

```powershell
./scripts/Restore-SiarePhase2.ps1
```

El script respalda el estado actual en frío, deja ClickHouse detenido y arranca
los ocho servicios anteriores sobre los mismos datos y claves. No restaura datos
antiguos encima de registros recientes. El Compose original está preservado en
`docker/recovery/compose.fase2.yaml.disabled`, fuera del descubrimiento automático.
`compose.yaml` es una guarda que rechaza el arranque accidental. Para regresar a
H1 vuelve a ejecutar `Migrate-Siare.ps1 -SkipBuild`; no uses el down del Compose
antiguo porque esa definición todavía considera propia la red data compartida.

## Recuperar datos desde una copia

Si hay corrupción, conserva el estado actual y utiliza un proyecto de recuperación
nuevo. La restauración verifica todos los hashes y rechaza cualquier volumen de
destino existente. No sobrescribe ni arranca servidores sobre los originales.

```powershell
./scripts/Restore-SiareBackup.ps1 -BackupPath '.local/backups/<fecha-id>' -RecoveryProject siare-recuperacion
```

Se restauran archivos, propietarios y permisos en volúmenes con el prefijo nuevo,
y se comparan contra el tar mediante GNU tar. Se escribe `siare-recuperacion.env`
privado dentro del respaldo. Comprueba los
datos antes de cambiar la instalación. Para arrancar esa copia, detén SIARE,
guarda su `.env` y selecciona el env de recuperación como `.env` en una copia del
repositorio; conserva las mismas claves e identidad. Ejecuta Initialize-H1 y el
inicializador de infraestructura sin `-NewInstallation`, y Start-Siare. Así se
crea la red de recuperación y, si el backup era de Fase 2, su volumen ClickHouse.
Los puertos siguen siendo 3100 y 8180, por lo que no arranques ambas instalaciones
a la vez. El cambio de instalación y la validación de una corrupción real son
operaciones de recuperación manual; H1 incluye un ensayo de restauración aislada.

## Alcance ClickHouse

Express recibe URL interna, usuario y contraseña por entorno. Test-ClickHouse
ejecuta SQL autenticado desde su contenedor, comprueba la tabla y exige rechazo
de una credencial incorrecta. No añade rutas de analítica ni altera el readiness
de negocio de Express. El esquema MergeTree `academic_events` usa UUID, fecha UTC,
tipo, puntuación y duración; no almacena nombres ni documentos. La tabla queda
vacía hasta implementar ingesta de eventos reales, deduplicación y consultas en
H4. No se instala ZooKeeper ni Keeper para este nodo independiente.

ClickHouse limita el contenedor a 1 GiB, el servidor a 768 MiB, cada consulta a
256 MiB y dos threads. Las cachés y pools de background son pequeños. Los límites
totales de contenedores suman 6848 MiB (6,69 GiB); son techos, no reservas. Docker
dispone aquí de 5,79 GiB, por lo que esos máximos simultáneos exceden su asignación.
El consumo observado y el margen bajo carga deben medirse; se recomiendan 8 GiB
para Docker en el equipo de 16 GB. H1 no cambia la asignación global de WSL/Docker.
Las compilaciones siguen siendo secuenciales.

Fuentes: [imagen oficial y variables de inicialización](https://github.com/ClickHouse/ClickHouse/blob/master/docker/server/README.md),
[imágenes LTS oficiales](https://hub.docker.com/_/clickhouse).
