# Validación local de SIARE

## Fase 2: validación del 10 de noviembre de 2026

El trabajo partió de `main` con el árbol limpio y continúa en `feature/fase2-documentos`, sin commit ni push. Se implementó el módulo documental y se conservaron los contratos Abstract Factory y las pruebas previas. [PHASE2.md](PHASE2.md) documenta los archivos, API, colecciones, configuración y procedimiento de prueba.

| Comprobación ejecutada | Resultado |
| --- | --- |
| Maven `clean verify` con Temurin JDK 21.0.13+9 portátil, y `verify` en Docker con Java 21 | 38 pruebas aprobadas en ambos entornos, cero fallos/errores/omisiones. Incluye las 18 de Fase 1. La reconstrucción final con la corrección DNS repitió las 38 en Docker. |
| Python 3.12, `unittest discover -s tests -v` | Host: 12 aprobadas y OCR real omitido explícitamente. Docker: las 13 aprobadas, incluido Tesseract español en PNG, JPG y JPEG. |
| Python `pip check` | Sin requisitos incompatibles. Dependencias directas y transitivas fijadas. |
| Frontend `npm test` | 12 pruebas aprobadas: salud, cookie/CSRF, rutas documentales, formatos y límite de bytes reales. |
| Next.js `npm run build` | Build aprobado, incluida `/api/files/[...path]`. |
| Frontend `npm run typecheck` | Aprobado, incluidas las pruebas Playwright nuevas. |
| Express `npm test` | Compilación TypeScript y tres pruebas aprobadas. |
| `docker compose config --quiet` y `config --services` | Configuración válida; ocho servicios. Sin salida de secretos. |
| Construcción y despliegue Docker | Cuatro imágenes construidas; aplicaciones sin root. Flask tiene Tesseract 5.3.0 con idioma `spa`; no publica puerto host. |
| `Test-Phase2.ps1 -SimulatePythonOutage -RestartContainers` | 165 verificaciones HTTP aprobadas. Se usaron Spring, MySQL, MongoDB/GridFS y Flask reales. |
| Recuperación y persistencia documental | Caída de Flask, original conservado y reintento exitoso; después, reinicio de los ocho contenedores con originales, texto, metadatos, JWT y cookie anteriores disponibles. |
| `Test-Phase1.ps1` sobre las imágenes finales | 31 comprobaciones HTTP aprobadas, Flyway V1 y BCrypt correctos. |
| `npm run test:e2e`, Playwright/Chromium | Seis pruebas aprobadas en 41,3 segundos: Fases 1 y 2 en 1440 px y 375 px, con movimiento reducido en móvil. |
| `Test-Siare.ps1` y estado final | Ocho servicios `healthy`; consultas reales a las cuatro bases; backends, frontend y puertos correctos. |
| Scripts PowerShell y script Node de Fase 2 | Parseo/sintaxis correctos. |
| Frontera hexagonal | Sin imports Spring/MongoDB/Flask en dominio o aplicación. |

Las pruebas Java documentales comprueban carga válida, rechazo de archivos vacíos, antiguos, corruptos, protegidos, MIME falso, nombres inseguros y tamaños excedidos; compensación de GridFS mediante el puerto; autorización en las seis rutas; materia archivada; descargas de adjunto; reserva, cola llena y reintento tras fallo. El adaptador HTTP se prueba contra un servidor HTTP local controlado: transmite bytes/credencial/operación, preserva `NO_EXTRACTABLE_TEXT` y rechaza respuestas excesivas, inválidas o de otra operación.

Las pruebas Python ejecutan pypdf, python-docx y python-pptx sobre fixtures sintéticos, incluyendo tablas, PDF sin texto y protegido. También comprueban paquetes ZIP maliciosos, OCR vacío mediante una dependencia controlada, límite/timeout, y la API Flask con autenticación interna. Una prueba recorre el controlador Flask y su subproceso con un PDF real. El host omite OCR real porque no tiene Tesseract instalado; el build Linux sí lo ejecutó y aprobó.

### Comprobaciones con servicios reales y recursos

El flujo real comprobó los seis formatos, SHA-256 y bytes originales descargados desde GridFS, unidades de origen y consulta del texto guardado. Rechazó archivos vacíos, DOC/PPT antiguos, documentos corruptos/protegidos, MIME falso y tamaño excesivo. Verificó las seis rutas sin autenticación y el acceso de otro estudiante. El BFF rechazó cargas sin origen/CSRF y exceso de bytes tanto con `Content-Length` como con transferencia chunked sin esa cabecera; mantuvo los 16 KiB para JSON.

La prueba detuvo exclusivamente Flask. Spring marcó el trabajo como fallido y siguió entregando el original; el reintento después de recuperar Flask terminó en `READY`. El reinicio posterior de la composición conservó tanto los documentos como las sesiones previas. Las materias archivadas mantuvieron consulta y descarga, y rechazaron carga y procesamiento. Se conservaron 20 metadatos sintéticos, 15 fragmentos de texto, 20 registros `fs.files` y 20 `fs.chunks`, incluidos los datos de la primera ejecución que detectó el fallo DNS. No se borraron datos.

MongoDB confirmó el índice compuesto de propietario/materia/fecha, el de estado/vencimiento y el índice único de fragmentos por documento/operación/posición. Las descargas usaron adjunto y `nosniff`; el navegador mantuvo JWT en cookie HttpOnly. Playwright verificó carga, texto, descarga idéntica al PDF original y consulta tras archivar, además del flujo previo de registro/materias y CSRF. Se inspeccionaron las capturas de escritorio y móvil y no hubo desbordamiento horizontal.

Antes del despliegue, Flask usaba 78,8 MiB sobre 256 MiB. Durante la extracción real, cgroup registró un pico de 204 107 776 bytes (194,65 MiB), con `oom=0`, `oom_kill=0` y límite de 268 435 456 bytes. Se mantuvieron los 256 MiB y todos los límites de los otros servicios. Esta medición usa fixtures pequeños y no dimensiona documentos en el límite ni carga concurrente.

Después de las pruebas, `docker stats --no-stream` registró Spring 317 MiB, Flask 50,76 MiB, Next 71,21 MiB, Express 25,62 MiB, Redis 8,99 MiB, Cassandra 1,09 GiB, MongoDB 219,5 MiB y MySQL 208,7 MiB. Docker informó cuatro CPU y 6 216 531 968 bytes de RAM. Los ocho servicios quedaron saludables.

Las evidencias están en `.cache/phase2-compose-build.log`, `.cache/phase2-core-recovery-build.log`, `.cache/phase2-live-validation.log`, `.cache/phase2-phase1-regression.log`, `.cache/phase2-browser-tests.log` y las capturas `phase2-documents-{desktop,mobile}.png`. Los fixtures se generan en `.cache/phase2-fixtures`. La credencial interna nueva quedó solo en `.env`, ignorado por Git; se conservaron las credenciales existentes. El JDK portátil se descargó de Eclipse Adoptium a `.cache/jdk21` y se verificó mediante SHA-256, sin cambiar Java globalmente.

### Incidencias corregidas en las pruebas

Se adaptó la inspección PDF a la API de PDFBox 3 (`getXrefTable`), se corrigió la comparación del tipo principal PPTX y se admitió exclusivamente el `.bin` de configuración de impresora presente en PPTX válidos. Se mantuvo el rechazo de macros, ActiveX y objetos incrustados. La prueba de timeout Python se ajustó para Windows, donde `os.killpg` no existe; el runtime Linux termina el grupo del parser y Tesseract.

Docker se detuvo al principio con `WSL update required`. Cuando el usuario pidió volver a verificar, Docker ya estaba operativo; se continuó la validación completa. No se ejecutó `wsl --update`, `wsl --shutdown`, limpieza Docker ni borrado de volúmenes.

La primera prueba real de recuperación detectó que el reintento inmediato no llegaba a Flask tras su arranque. Se ajustó la caché DNS de la JVM de Spring (negativa cero, positiva cinco segundos), se añadieron diagnósticos limitados a la clase del error y la repetición completa pasó. También se desactivó el socket administrativo Gunicorn que intentaba usar `/home/siare` y registraba un error de permisos.

No quedan fallos conocidos en el flujo solicitado. No se ejecutó una prueba de carga ni una evaluación con lector de pantalla. El ejecutor no recupera automáticamente trabajos después de un reinicio: el usuario puede reintentarlos al vencer su reserva de 120 segundos. Una doble caída que también impida compensar GridFS puede dejar originales huérfanos; se documenta la necesidad de reconciliación. La fase no incorpora recolector automático, OCR de PDF escaneados ni reconocimiento de texto dentro de imágenes incrustadas en Office.

---

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
