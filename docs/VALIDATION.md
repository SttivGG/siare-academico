# Validación local de SIARE

Fecha: 9 de noviembre de 2026, zona America/Bogota. Las horas UTC de los contenedores pueden mostrar el 10 de noviembre. Los comandos se ejecutaron dentro del repositorio local, sin commits, push, acceso a Google Drive ni borrado de volúmenes.

## Fase 1: resultado actual

Se implementaron usuarios, autenticación JWT y materias propias con arquitectura hexagonal, persistencia MySQL y una interfaz Next.js con BFF. Se conservaron los ocho servicios, las cuatro bases de datos, los puertos, las verificaciones de salud y los contratos Abstract Factory. La guía de uso, endpoints, cuerpos JSON y configuración está en [PHASE1.md](PHASE1.md).

| Verificación ejecutada | Resultado |
| --- | --- |
| `docker compose build core-api`, Maven `verify` con Java 21 | BUILD SUCCESS; 18 pruebas, cero fallos, errores u omisiones. |
| Dependencias inspeccionadas en el JAR de la imagen final | Spring Boot 4.1.2, Spring Security 7.1.2, Flyway core/mysql 12.4.0, Connector/J 9.7.0. |
| `npm test` en host y build Docker de Next | Ocho pruebas aprobadas. |
| `npm run build` en host y build Docker de Next | Build aprobado, con las rutas de registro, login, inicio y materias. |
| `npm run typecheck` en host y build Docker de Next | Aprobado. |
| `docker compose config --quiet` y listado de servicios | Configuración válida; exactamente ocho servicios. |
| Migración en MySQL 8.4.13 existente | V1 aplicada; consulta de `flyway_schema_history` confirmó versión 1 y success=1. |
| Comprobación de hashes en MySQL | Cero usuarios con hash fuera del formato BCrypt de coste 12; solo se consultaron conteos, sin imprimir hashes. |
| `Test-Phase1.ps1` | 31 verificaciones HTTP reales aprobadas. |
| `Test-Phase1.ps1 -RestartContainers` | 34 verificaciones HTTP aprobadas, incluido el uso de tokens y sesiones anteriores al reinicio. |
| `npm run test:e2e`, Chromium mediante Playwright 1.65.0 | Cuatro pruebas aprobadas: flujo completo y frontera de sesión/CSRF en escritorio 1440x1000 y móvil 375x812. |
| `Test-Siare.ps1` después del reinicio | Ocho servicios healthy; consultas autenticadas a cuatro bases de datos; tres backends, frontend, recorrido Next/Spring y puertos correctos. |

La suite Java usa H2 en modo MySQL con Flyway y el filtro real de Spring Security. Comprueba registro, normalización, BCrypt, correo duplicado, campos inválidos, límite UTF-8, login, contraseña incorrecta y cuenta inexistente. También valida peticiones sin autenticación, tokens inválidos, alterados, vencidos, sin expiración, con emisor o sujeto inválido y con otro algoritmo RSA. Las pruebas de materias cubren creación, listado propio, denegación a otro estudiante en lectura/edición/archivo, PATCH parcial, eliminación de descripción con null, archivo idempotente y consulta posterior.

Las solicitudes reales contra MySQL comprobaron además dos registros concurrentes del mismo correo: uno obtuvo 201 y el otro 409. El BFF rechazó operaciones sin Origin, con origen ajeno o sin cabecera CSRF; el login devolvió la cookie HttpOnly y SameSite=Lax sin exponer el access token en el cuerpo. Se consultó `/inicio` con la sesión BFF y se creó una materia desde Next.

La prueba de persistencia reinició exclusivamente los ocho contenedores de esta composición y esperó su recuperación. Después comprobó el mismo usuario con el token emitido antes del reinicio, la materia actualizada y archivada, la descripción eliminada y la materia creada a través del BFF con su cookie anterior. Esto verifica tanto MySQL como la conservación de las claves RSA del volumen `jwt-keys`.

Las pruebas de navegador recorrieron registro, login erróneo y correcto, inicio del estudiante, creación, edición, archivo, filtro de archivadas y cierre de sesión. Comprobaron redirección de rutas privadas, cookie HttpOnly, localStorage vacío, sesiones inválidas, rechazo CSRF, navegación por teclado entre campos y ausencia de desbordamiento horizontal. Se revisaron las capturas de escritorio y móvil del espacio de trabajo; en móvil se activó movimiento reducido.

## Incidencias corregidas durante Fase 1

1. El primer selector de error de Playwright coincidía también con el anunciador accesible de rutas de Next.js. Se limitó al formulario y las cuatro pruebas pasaron.
2. La primera comprobación posterior al reinicio reutilizó un socket HTTP cerrado por Docker y recibió ECONNRESET. El script de validación pasó a cerrar cada conexión deliberadamente antes del reinicio. Se repitió la prueba completa con éxito; no se añadieron reintentos que oculten fallos de los endpoints.

Los builds Java emitieron avisos de carga dinámica del agente Mockito y de la propiedad Hibernate de timestamps usada en H2. Flyway advirtió que H2 2.4.240 es posterior a su última versión H2 verificada; las pruebas pasaron. La ejecución sobre MySQL 8.4.13 aplicó y validó la migración correctamente. El JDK 22 del host no se usó como evidencia de compilación Java 21: el build definitivo ocurrió dentro de Docker.

## Límites y estado de entrega

Los ocho servicios quedaron en ejecución y saludables. Las claves privadas permanecen en el volumen Docker externo al repositorio, montado en modo lectura para Spring. Las pruebas conservaron cuentas sintéticas `@example.test` y sus materias; no eliminaron datos. Las evidencias locales están en `.cache/phase1-core-build.log`, `.cache/phase1-frontend-build.log`, `.cache/phase1-live-validation.log` y las capturas `phase1-workspace-desktop.png` y `phase1-workspace-mobile.png`.

No quedan fallos conocidos en el flujo solicitado. La identidad visual definitiva espera las referencias de Nexo. No se ejecutaron pruebas de carga, una auditoría manual con lector de pantalla ni validación de un despliegue TLS de producción. El Compose mantiene HTTP en loopback y la excepción explícita de cookie sin Secure; la configuración por defecto del BFF y su prueba aislada cubren Secure, pero el navegador local no prueba HTTPS. El cierre de sesión elimina la cookie; no se implementaron refresh tokens ni revocación.

## Registro histórico de la infraestructura

Los apartados siguientes registran la validación anterior a Fase 1. Sus referencias a tablas o autenticación pendientes describen ese estado previo; el resultado actual es el documentado arriba. El hash del POM que figura más abajo también corresponde a esa versión anterior a añadir Flyway y H2.

## Estado inicial

El proyecto existente contenía `SiareCoreApplication`, un `application.properties` con el nombre de aplicación y una prueba de contexto. El `pom.xml` ya declaraba Java 21, Spring Boot 4.1.2, Actuator, JPA, MongoDB, Security, OAuth2 Resource Server, Validation y Web MVC. Se conservaron el archivo y la ubicación del proyecto.

La primera ejecución `mvn -B -ntp verify` falló en `contextLoads`: `Failed to determine a suitable driver class`, porque no había URL MySQL configurada. Se añadió configuración de conexiones mediante variables obligatorias y un perfil de pruebas aislado. No se ocultó el fallo de conexión en la configuración de ejecución.

No se encontraron instrucciones `AGENTS.md` ni metadatos Git en la raíz. No fue posible obtener un diff Git inicial. El SHA-256 del `pom.xml` conservado es:

```text
249e72fa880134fccdb9020b99aaf6dfd0f0a5b48d24f805df059129cf4e42f8
```

## Entorno observado

| Componente | Versión o recurso observado |
| --- | --- |
| Windows | Windows 11, PowerShell 5.1 y PowerShell 7 |
| Java del host | Oracle JDK 22.0.1; compilación con `--release 21` |
| Maven del host | 3.10.0 |
| Python del host | 3.12.0, entorno virtual local |
| Node.js del host | 24.14.0, npm 11.9.0 |
| Docker Desktop | 4.91.0, engine 29.8.0, Linux amd64 |
| Compose | v5.5.1 |
| Recursos Docker | Cuatro CPU; 6216568832 bytes de RAM, aproximadamente 5,79 GiB |
| Java del build Docker | Temurin 21.0.12.1, Maven 3.9.16 |
| Java del runtime Docker | Temurin 21.0.13+9 LTS |

El acceso inicial al pipe Docker estaba restringido por el entorno de ejecución del agente. La ejecución autorizada de los comandos Docker permitió construir e iniciar los servicios. No se modificó la asignación global de memoria de Docker ni la configuración WSL2.

## Resultados ejecutados

| Verificación | Resultado |
| --- | --- |
| Compilación y empaquetado Spring en Windows | `BUILD SUCCESS`, cuatro pruebas, cero errores |
| Compilación y pruebas Spring en Docker con JDK 21 | `BUILD SUCCESS`, cuatro pruebas, cero errores |
| Pruebas Flask con `unittest` | Dos pruebas correctas; salud y error sin detalles sensibles |
| Consistencia de dependencias Python | `pip check`: sin requisitos rotos |
| Pruebas Express y compilación TypeScript | Tres pruebas correctas; éxito, fallo y excepción inesperada |
| Pruebas de comunicación del frontend | Cinco pruebas correctas; UP, HTTP 503, JSON inválido, contrato inválido y configuración ausente |
| Build Next.js de producción | Correcto, página y ruta de salud dinámicas |
| TypeScript frontend | `tsc --noEmit` correcto |
| `docker compose config --quiet` | Correcto, ocho servicios |
| Dockerfiles | Construidas las cuatro imágenes de aplicación con bases fijadas por digest |
| Arranque Compose | Ocho servicios `healthy` |
| Verificación en PowerShell 7 | Correcta |
| Verificación en Windows PowerShell 5.1 | Correcta después de corregir el parseo de arrays JSON |
| Frontera Java | Sin imports Spring en `domain` ni `application` |
| Credenciales | Ninguna contraseña generada encontrada en los archivos fuente/configuración/documentación entregables |

Las suites aisladas suman catorce pruebas distintas. Las dependencias de esas pruebas son controladas; la verificación Docker siguiente usa servicios y conexiones reales.

## Salud y conexiones reales

`Test-Siare.ps1` terminó con código cero y confirmó:

```text
OK healthy: mysql
OK healthy: mongo
OK healthy: cassandra
OK healthy: redis
OK healthy: core-api
OK healthy: content-ai
OK healthy: progress-api
OK healthy: frontend
OK conexion autenticada/consulta: mysql
OK conexion autenticada/consulta: mongo
OK conexion autenticada/consulta: cassandra
OK conexion autenticada/consulta: redis
OK Flask y Mongo/Redis
OK Express y Cassandra
OK: tres backends, cuatro bases de datos, puertos y frontend -> Spring.
```

MySQL ejecutó `SELECT 1` mediante TCP con su usuario de aplicación. MongoDB autenticó al usuario de contenidos y ejecutó `connectionStatus` y `ping`. Cassandra respondió a la consulta de `release_version` en `system.local`. Redis respondió `PONG` con autenticación. No se crearon datos de negocio para estas comprobaciones.

Se observaron estas respuestas desde Windows:

```text
GET http://127.0.0.1:8180/health        200 {"status":"UP"}
GET http://127.0.0.1:3100/api/health    200 {"service":"frontend","status":"UP"}
GET http://127.0.0.1:8180/actuator/env  403
```

La página devolvió HTTP 200 y el texto `Spring disponible`. El código de la página y de `/api/health` consulta Spring en el servidor Next.js; no se utilizó una respuesta de éxito simulada.

Docker confirmó únicamente `127.0.0.1:8180->8080/tcp` y `127.0.0.1:3100->3000/tcp` como publicaciones al host. Los puertos que aparecen sin una asignación `host->container` en `compose ps` son metadatos internos de las imágenes, no puertos publicados.

## Fallos corregidos durante el trabajo

1. La prueba Spring inicial dependía de una configuración de datos ausente. El perfil de test ahora excluye la autoconfiguración JDBC/MongoDB; la configuración de ejecución exige credenciales y utiliza los contribuidores reales de salud.
2. La configuración Cassandra 4.1.12 usa `memtable_heap_space`, `memtable_offheap_space`, `file_cache_size` y `compaction_throughput` con unidades. Se ajustó el script contra el archivo oficial de esa versión.
3. El primer arranque Cassandra falló porque una sustitución `sed` interpretaba la barra de `16MiB/s` como delimitador. Se cambió el delimitador y se repitió el arranque sin borrar su volumen.
4. Windows PowerShell 5.1 conservaba un array JSON como un único elemento de pipeline. Se corrigió su lectura y se ejecutó de nuevo el script completo con éxito en esa versión.
5. Se añadieron límites de dos segundos a la selección de servidor y sockets MongoDB de Spring. La prueba de caída real confirmó respuestas acotadas.

Maven del host emitió un aviso 403 al consultar metadatos opcionales del repositorio de snapshots OW2. El build terminó correctamente; el build Docker con JDK 21 también pasó. Mockito emitió avisos sobre carga dinámica de agentes del JDK; no hubo fallos de pruebas. No se modificaron configuraciones globales para silenciarlos.

## Caída y recuperación

Se detuvo únicamente el contenedor MongoDB de esta instancia SIARE, sin eliminarlo ni tocar su volumen. Durante esa caída:

```text
Spring /health:       HTTP 503, {"status":"DOWN"}, 2,12 segundos
Next.js /api/health:  HTTP 503, {"service":"frontend","status":"DOWN"}, 2,02 segundos
```

Se comprobó que los cuerpos solo contenían estado y, en Next.js, nombre del servicio. Se volvió a iniciar MongoDB; Compose recuperó los ocho estados `healthy` y el script completo pasó otra vez. Esto comprueba que el frontend no conserva un UP obsoleto ante la caída de Spring/dependencias.

También se ejecutaron `Stop-Siare.ps1` y `Start-Siare.ps1 -SkipBuild` desde Windows PowerShell 5.1. Ambos terminaron correctamente, se conservaron los cinco volúmenes y la verificación posterior volvió a pasar. Los ocho servicios quedaron iniciados y saludables al entregar.

## Memoria medida

Una lectura de `docker stats --no-stream` con los ocho servicios saludables y sin carga de negocio mostró:

| Servicio | Memoria observada aproximada |
| --- | --- |
| Cassandra | 1,083 GiB |
| MongoDB | 435,1 MiB |
| MySQL | 261,5 MiB |
| Spring | 255,3 MiB |
| Next.js | 66,76 MiB |
| Flask | 56,13 MiB |
| Express | 27,23 MiB |
| Redis | 3,63 MiB |

El total observado fue aproximadamente 2,16 GiB. Es una medición de desarrollo sin carga, no un dimensionamiento de producción. `nodetool info` confirmó transporte CQL y gossip activos, cero excepciones y heap de aproximadamente 158,93 / 748,81 MB reportados por la JVM. El límite configurado del heap es 768 MiB; la JVM informa una capacidad utilizable ligeramente menor.

Docker dispone aquí de menos memoria que los 8 GiB recomendados en el README. La composición arrancó con esa asignación; el margen para compilaciones y carga adicional sigue siendo limitado.

## Alcance pendiente

Los contratos Abstract Factory están diseñados y compilados. Las fábricas y los productos concretos Quiz/Crossword siguen pendientes. Tampoco se implementaron esquemas de negocio, GridFS, autenticación de usuarios, ML o dashboard.

Cassandra utiliza el modo sin autenticación del entorno local aislado. Este Compose no está preparado para producción; los requisitos de TLS, secretos administrados, roles, backups y despliegue con carga deben resolverse antes de ese uso. La UI se verificó por HTTP y por sus pruebas de comunicación; no se hizo una evaluación visual con navegador ni una prueba de carga.

Los logs locales de construcción y verificación están en `.cache/` y se excluyen de Git. No deben tratarse como archivos de configuración ni compartirse sin revisar su contenido.
