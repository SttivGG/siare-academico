# H0 y H1: resultados de ejecución

Fecha: 10/11/2026, America/Bogota. Alcance: proteger Fase 2, separar Docker Compose,
agregar infraestructura ClickHouse y preparar el plan académico. H2-H5 permanecen
pendientes.

Estado final: nueve servicios saludables, web en http://127.0.0.1:3100 y salud
Spring en http://127.0.0.1:8180/health. H1 cambia o añade 36 archivos. El conjunto
H0/H1 se entrega en `feature/adecuacion-instructivo`; el usuario autorizó después
de la validación inicial crear el commit H1 y publicar exclusivamente esa rama.

## Protección de Fase 2

Se creó el commit **local** `2d7aa04d739f8f65245d25f2201ec033382b1bbe` en
`feature/fase2-documentos`, con 64 archivos y la verificación
[H0_VERIFICACION.md](H0_VERIFICACION.md). Desde ese commit se creó
`feature/adecuacion-instructivo`. Al cerrar H0 no se realizó push; la publicación
posterior de H0/H1 en la rama de adecuación fue solicitada explícitamente por el
usuario. `main` se conserva en `a8bb7c221a526509b0cc8b513dffccba975ac7cb`.

Antes del commit se ejecutaron 38 pruebas Java, 13 Flask con OCR real, 12 frontend,
tres Express, seis Playwright escritorio/móvil, 31 comprobaciones HTTP de Fase 1
y 124 de Fase 2. El Compose original tenía ocho servicios saludables. Se revisó
el conjunto de archivos y no se encontraron credenciales locales ni claves
privadas en los entregables. `.env`, claves y respaldos quedan fuera de Git.

## Infraestructura y datos

Los dos archivos nuevos son válidos individualmente y combinados. Los scripts
usan el mismo proyecto Docker y la red externa `siare-academico_data`, que
conserva su ID, etiquetas y `internal=true`. `edge` conserva la comunicación
Next/Spring. Los siete volúmenes declarados son externos con nombres explícitos;
los seis previos se conservaron y el séptimo pertenece exclusivamente a ClickHouse.

ClickHouse usa `26.8.36.3`, verificada en el registro y fijada al digest
`sha256:d426d2f612e1e189c90f9a3f8dcd85a03c6851273833817a296bb327e63aa7a7`.
Su healthcheck ejecuta `SELECT 1` con credenciales. Express ejecutó otra consulta
SQL por HTTP autenticado desde su propio contenedor y confirmó el esquema; una
contraseña sintética incorrecta produjo HTTP 403. `academic_events` existe en
`siare_analytics` y contiene **cero registros**. No se presenta como integración
de analítica funcional: faltan ingesta, consultas de negocio y dashboard.

Antes de recrear contenedores se generó el respaldo frío
`.local/backups/20261110-141412-bcc8c3ff`, con seis archivos tar, sus tamaños y
SHA-256, `.env` y el Compose anterior. Todos los archivos comprimidos se pudieron
leer. El respaldo permanece privado e ignorado. No se borraron volúmenes ni datos.

La comparación inmediatamente anterior y posterior a la primera migración fue
idéntica:

| Dato comparado | Resultado |
| --- | --- |
| MySQL: 49 usuarios y 31 materias | Conteos y CHECKSUM TABLE idénticos |
| MongoDB: 40 metadatos documentales | SHA-256 de todos los registros idéntico |
| MongoDB: 37 fragmentos de texto | SHA-256 de todos los registros idéntico |
| GridFS: 40 fs.files y 41 fs.chunks | SHA-256 de todos los registros, incluidos bytes binarios, idéntico |
| RSA privada y pública | SHA-256 idénticos, sin exponer contenido |
| Montajes persistentes anteriores | Mismos seis nombres físicos y destinos |
| Usuario y materia creados antes de migrar | Consultables después |
| PDF anterior, texto y JWT anterior | Descarga con SHA-256 idéntico, texto disponible y token aceptado |
| Login de la cuenta anterior | Correcto después de migrar |

Las suites posteriores crearon más datos sintéticos `example.test`; no se
eliminaron. Los conteos anteriores corresponden al instante de la migración y no
se usan como constantes para futuras pruebas.

## Pruebas H1

| Comprobación ejecutada | Resultado |
| --- | --- |
| config --quiet de datos, apps y ambos | Correctos |
| Migrate-Siare.ps1 -SkipBuild | Respaldo previo, montaje de volúmenes originales y arranque correctos |
| Test-Siare.ps1 | Nueve healthy, SQL/consultas reales de cinco motores, tres backends y recorrido Next/Spring |
| Puertos publicados inspeccionados | Solo 127.0.0.1:3100 y 127.0.0.1:8180; cero publicaciones de bases |
| Test-Phase1.ps1 | 31 comprobaciones HTTP, Flyway V1 y BCrypt correctos |
| Test-Phase2.ps1 -SimulatePythonOutage -RestartContainers | 162 comprobaciones HTTP en la repetición aislada; caída/reintento Flask y reinicio de nueve servicios correctos |
| Persistencia tras reiniciar | Originales, fragmentos, metadatos, firma JWT y cookie anteriores conservados |
| Playwright final sobre H1 recreado | Seis pruebas de Fases 1 y 2 aprobadas en escritorio y móvil, 26,5 segundos |
| Restore-SiareBackup.ps1 | Seis volúmenes nuevos siare-h1-drill; restauración y comparación GNU tar de contenido, propietarios y permisos correctas |
| Restore-SiarePhase2.ps1 | Respaldo previo de siete volúmenes, ocho servicios anteriores saludables y continuidad de datos/token correctas; ClickHouse detenido |
| Retorno a H1 y Start-Siare.ps1 en PowerShell 5.1 | Nueve servicios saludables; huellas de MySQL, MongoDB/GridFS, RSA y montajes idénticas después de ida y vuelta |
| Stop-Siare.ps1 -RemoveContainers y Start-Siare.ps1 -SkipBuild en PowerShell 5.1 | Se retiraron y recrearon los nueve contenedores; datos, claves, montajes y token anterior conservados; nueve healthy |
| Inicializadores en Windows PowerShell 5.1 | Correctos; hash de .env e ID de red sin cambios |
| Compose anterior archivado | Igual al commit H0, normalizando finales de línea |
| docker compose config sin archivos explícitos | Rechazado por la guarda; evita arrancar el Compose anterior por accidente |
| Guardas de persistencia | NewInstallation rechaza proyecto existente; restauración rechaza sobrescribir el proyecto actual; respaldo de archivos activos rechazado |
| Parseo PowerShell, node --check y git diff --check | Correctos |
| Revisión anterior a la publicación solicitada | Test-Phase1.ps1: 31 comprobaciones HTTP; Test-Phase2.ps1 sin modificadores: 155 comprobaciones HTTP, incluidos sondeos de procesamiento; ambos terminaron correctamente |
| Estado anterior a publicar | Nueve servicios healthy; ambos Compose válidos; SQL desde Express y puertos correctos; 211 archivos revisados sin credenciales locales ni claves privadas |

El retorno y la posterior recreación de contenedores conservan 57 usuarios, 35 materias, 57 metadatos, 50 fragmentos,
57 fs.files y 58 fs.chunks, con huellas idénticas a las tomadas antes del ensayo.
Los seis volúmenes `siare-h1-drill_*` quedan
como copia de recuperación aislada y sin servidores asociados; no sustituyen a
los volúmenes de SIARE.

No se ensayó una instalación vacía ni corrupción real de los archivos. La copia
aislada se verificó byte a byte contra sus tar, sin arrancar servidores sobre ella.
La reversión de despliegue y la posterior recreación sí se probaron con servicios
y datos reales de esta instalación.

## Memoria e incidencias

Con nueve servicios saludables y sin carga, una muestra mostró ClickHouse
494,1 MiB/1 GiB, Cassandra 1,096 GiB/2,5 GiB, Spring 319,5 MiB/768 MiB,
MongoDB 195,9 MiB/768 MiB, MySQL 211,9 MiB/640 MiB, Flask 55,71 MiB/256 MiB,
Next 64,68 MiB/384 MiB, Express 29,66 MiB/256 MiB y Redis 14,6 MiB/192 MiB.
El total observado fue aproximadamente 2,45 GiB. No es una prueba de carga.
Los techos suman 6,69 GiB y Docker dispone de 5,79 GiB: no pueden sostenerse todos
los máximos simultáneamente. Se conservaron límites pequeños y compilación
secuencial; no se modificó la configuración global de Docker ni WSL.

Dos ejecuciones documentales, una en H0 y otra después de migrar, terminaron con
ECONNRESET después de las seis extracciones, mientras coincidían con otras
comprobaciones o restauración. Las repeticiones aisladas completas pasaron. No
se ha establecido una causa raíz; se añadió la ruta HTTP al diagnóstico de la
prueba, sin tokens ni cuerpos. Ocho envíos directos de archivo excedido a Spring
devolvieron 413. Esta intermitencia queda registrada como limitación de la
verificación bajo operaciones simultáneas; no se ocultó con reintentos
automáticos de peticiones ni se relajaron las aserciones.

Playwright requirió indicar Chrome ya instalado; no se descargó otro navegador.
El ensayo PowerShell 5.1 detectó que el paso nativo quitaba comillas de una
plantilla Docker con una clave de etiqueta. Se cambió esa lectura a inspect JSON,
y el arranque completo en 5.1 pasó. El error ocurrió después del respaldo y antes
de recrear servicios; no afectó datos.
Los avisos Maven/Mockito de H0 no impidieron el build. El procedimiento conserva
otros proyectos Docker; no ejecuta limpieza global, eliminación de volúmenes,
cambios de contraseña ni configuración WSL. El push autorizado posteriormente
se limita a `feature/adecuacion-instructivo`, sin merge ni push a `main`.

## Archivos y evidencias

| Grupo | Archivos cambiados o nuevos en H1 |
| --- | --- |
| Compose | compose.datos.yml, compose.apps.yml, compose.yaml como guarda y docker/recovery/compose.fase2.yaml.disabled |
| ClickHouse | docker/clickhouse/10-academic.sh, 10-academic.sql, limits.xml y users.xml |
| Inicialización y operación | scripts/Common.ps1, Initialize-Siare.ps1, Initialize-SiareKeys.ps1, Initialize-H1.ps1, Initialize-SiareInfrastructure.ps1, Start-Siare.ps1 y Stop-Siare.ps1 |
| Migración y recuperación | scripts/Backup-Siare.ps1, Migrate-Siare.ps1, Restore-SiarePhase2.ps1 y Restore-SiareBackup.ps1 |
| Verificación | scripts/Test-Siare.ps1, Test-Phase1.ps1, Test-Phase2.ps1, Test-ClickHouse.ps1, Get-SiarePersistence.ps1, compose-command.mjs, test-phase1.mjs, test-phase2.mjs y test-h1-continuity.mjs |
| Configuración/documentación | .env.example, README.md, docs/ARCHITECTURE.md, PHASE1.md, VALIDATION.md, MIGRACION_H1.md, PLAN_ENTREGA_2026_2.md y H1_RESULTADOS.md |

Evidencias locales: `.cache/h1-migration.log`, `h1-before.json`, `h1-after.json`,
`h1-phase1.log`, `h1-phase2.log`, `h1-phase2-diagnostic.log`, `h1-restore-drill.log`,
`h1-rollback.log`, `h1-remigration-ps51.log`, `h1-start-ps51.log`, `h1-stop-ps51.log`,
`h1-recreate-ps51.log`, `h1-after-recovery.json`, `h1-after-recreate.json` y los respaldos en `.local/backups`.
La regresión de navegador final está en `.cache/h1-browser-final.log`.
La revisión anterior a publicar está en `.cache/prepush-phase1.log` y
`.cache/prepush-phase2.log`; las referencias remotas iniciales se registraron en
`.cache/prepush-remote-refs.txt`.
Los JSON de persistencia contienen conteos y hashes; el fixture privado de
continuidad está en `.local/h1-continuity.json`.

El plan académico registra responsables propuestos, aceptación, riesgos y los
pendientes React Native/APK, OIDC, roles, MFA/recuperación, sesiones, ML,
concurrencia de negocio, cinco módulos, Abstract Factory concreto, OpenAPI e
informe final, con entrega 25/11/2026 y sustentación 02/12/2026.
