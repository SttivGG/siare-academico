# Verificación de H5-B y main consolidado

19/11/2026, America/Bogota. Rama `feat/h5-b-generation-port`.
Main consolidado `c8f934492f0cc7809282657270df34b4474915ca`, árbol igual al
preparado `3792e5fee2d7dfc7cbd491c5b3c281051611d68c` y al integrado/desplegado
`697621ee8a6a450c551bbf6f13ffda6fc2beab18`. Tras autorización explícita del usuario,
#6 se fusionó mediante `fe2f39d6f2235533f70bf8219e8f26ebc3a219b6`; #7 se actualizó
a `a5810a23a78556fd321ba695fe82ac79302c396f` y se fusionó mediante `c8f9344`.
El main anterior `6c3a742` permanece como ancestro. No se reescribió el historial.
El commit de implementación y enlace del PR quedan identificados por la cabecera
de su PR y el historial de esta rama; este informe no se atribuye un SHA propio.

## Pruebas ejecutadas en esta tarea

| Comprobación | Resultado real |
| --- | --- |
| H5-A offline, tanto original como copia de la rama H5 | 24 tests, cero fallos; pip check correcto |
| Spring previo a H5 | Maven offline verify: 167 tests, cero fallos/errores, dos omitidos optativos |
| Spring final con H5 y PDF original optativo | Maven offline verify: 230 tests, cero fallos/errores, uno omitido |
| H5 dentro de Spring final | 63 tests: 50 contrato/HTTP y 13 caso de uso/admisión/configuración |
| Frontend integrado, sin cambios nuevos de diseño | 31 pruebas unitarias/componentes, todas pasadas |
| Frontend antes del merge autorizado #7 | 31/31 repetidas; árbol idéntico al revisado y desplegado |
| Regresión documental HTTP contra instalación habitual | 227 comprobaciones pasadas, sin restart ni outage |
| Chromium real, http://127.0.0.1:3100 | 22/22, escritorio 1440×1000 y móvil 375×812; 1,8 minutos |
| Controles oficiales scripts/Test-Siare.ps1 | Nueve healthy, cinco motores consultados con autenticación, tres backends y Next/Spring correctos |
| Preservación del checkout | 29 archivos anteriores conservados por SHA-256; 21 H5-A originales y copia idénticos |
| Preservación de despliegue | Nueve IDs/imágenes/montajes/redes idénticos; tres archivos protegidos sin cambios de huella |

JDK usado: Temurin 21 local de `.cache/jdk21`; Maven 3.10.0 con caché offline
`.cache/m2`. H5-A usa su entorno Python 3.12 aislado, fuera de `services/content-ai`.

Comando Spring final, desde la raíz, con JAVA_HOME en el JDK 21:

```powershell
$cache = (Resolve-Path .cache/m2).Path
$original = (Resolve-Path .cache/pdf-diagnosis/original.pdf).Path
mvn -o -f .worktrees/h5-b/services/core-api/siare-core/pom.xml "-Dmaven.repo.local=$cache" "-Dsiare.test.pdf=$original" verify
.cache/h5-contract-venv/Scripts/python.exe -m unittest discover -s .worktrees/h5-b/scripts/contracts -p 'test_*.py' -v
.cache/h5-contract-venv/Scripts/python.exe -m pip check
```

`DocumentBrowserIntegrationTests` fue el único omitido en la ejecución final:
requiere un despliegue desechable con Mongo y señal de finalización de navegador.
No se declara ejecutado. En su lugar se repitieron los recorridos HTTP y Chromium
sobre la instalación habitual, con sus bases reales; eso no equivale a ejecutar
esa inspección JUnit directa. Las pruebas etiquetadas real-stores siguen bajo su
selección explícita existente y no forman parte del verify por defecto.

Las pruebas nuevas H5 usan hechos sintéticos y un `HttpServer` local: prueban
peticiones/cabeceras reales, ambos DTO, contenido insuficiente, OCR/ambigüedad como
errores contractuales, 429/503 y Retry-After, 401/403 internos, errores de proveedor,
timeout de cabeceras y cuerpo, cancelación local, indisponibilidad, JSON estricto,
límites, ecos, advertencias, evidencia, claves y respuestas. El servidor simulado
solo existe en tests. No se probó un servicio ML real ni su capacidad académica.

El caso de uso prueba rechazo de identidad inhabilitada/anónima, materia ajena o
archivada, documento ajeno/no READY, selección inválida, versión vieja, snapshots
modificados y autorización revocada durante la petición; comprueba liberación de
admisión al fallar y bloqueo de la activación por flags de configuración.

Chromium repitió Quiz/Crucigrama completos, resultados autorizados, paginación,
bancos grandes, límites de rol, renovación/revocación de sesión, MFA y recuperación,
CSRF y recorridos seguros de OIDC. No se repitió el inicio de sesión interactivo
con proveedores externos. El documento C2PA pasó carga, cuarentena, READY, selección,
13 páginas y descarga íntegra. SHA-256 original:
`66cdd9f6cd895d4837cd68aa1208d89ca4bf4b9760e2c24e54cbf9e76815735e`.
C2PA permanece sin verificación criptográfica.

El wrapper Test-Phase2.ps1 no completó: `docker cp` informó que no encontraba un
directorio que `docker exec` sí podía listar. Se conserva ese fallo como tal.
Se ejecutó directamente `node scripts/test-phase2.mjs`, con las fixtures sintéticas
locales disponibles y SIARE_TEST_PDF apuntando al original privado; pasó 227 checks.
No se modificó el wrapper ni el módulo Python para resolverlo.

## Instalación habitual y Docker

Proyecto Compose `siare-academico`, identidad
`da86fb58046a48188cbcf41ddc682aec`, archivos oficiales `compose.datos.yml`,
`compose.apps.yml`, `.env` existente y override de frontend congelado
`.local/deployment-h4-20261119/frontend-source.json`.

| Servicio | Contenedor conservado | Estado final |
| --- | --- | --- |
| frontend | eae9ae80e3c1 | healthy |
| core-api | 27138d454210 | healthy |
| content-ai | 8a7f97dc46a9 | healthy |
| progress-api | c5ee706867eb | healthy |
| mysql | a874a4f0ab46 | healthy |
| mongo | c11e8984ca8b | healthy |
| cassandra | 274b64b24986 | healthy |
| redis | d7b516acd286 | healthy |
| clickhouse | f93db5993ddb | healthy |

| Aplicación | Imagen activa SHA-256 |
| --- | --- |
| frontend | c67d08bd4d4ef8e405f1d886ed3fec4c9fdb62f06be117184a8ff68c7c9ff5b0 |
| core-api | ecff70dea3a1061462ec103d81fed5f6729a2b8cee1113670afc87f814642e84 |
| content-ai | 212a8df4b6896d98ad607d66db4c7f03d562fa871dffa8f8e9bae93d17f36ba4 |

Frontend declara rama `integration/h4-documents-deploy-20261119` y revisión
`697621ee8a6a450c551bbf6f13ffda6fc2beab18`. Spring y Python no declaran revisión
Git OCI; se registran sus imágenes, sin atribuirles un commit por una etiqueta
inexistente. H5-B no está en esos contenedores.

Se confirmó la imagen de reversión `siare-academico-frontend:pre-h4-20261119`,
`sha256:fcf1dcfef4b24fc51ac886e48d5a81f2a19e15a9aba81da47895d20e2033b950`, y
la etiqueta Spring `siare-academico-core-api:pre-document-deploy-20261118`,
ID `54f9a33b11c2`. No se usaron para reiniciar o revertir servicios.

H5-B solo instala componentes desconectados de producción y pruebas de contrato.
Según la excepción expresa de la etapa Docker de esta tarea, no se construyeron
imágenes ni se recrearon contenedores habituales. El JAR probado es un artefacto
de validación, no un despliegue acreditado. La activación futura requiere
reconstruir y recrear selectivamente core-api con los controles oficiales,
reversión conservada y espera healthy; frontend solo si cambia su código.

Lectura final: HTTP 200 en `/`, texto `Spring disponible`, frontend UP en
`/api/health` y core UP en `http://127.0.0.1:8180/health`. No se eliminaron datos,
volúmenes ni redes; se conservaron .env y archivos de claves por huella. Los datos
sintéticos creados por las regresiones permanecen en la instalación. No se
modificaron React Native, Express, ClickHouse, MFA/OIDC ni migraciones en el delta H5.

## Cierre de las fusiones autorizadas

Se volvieron a comprobar estado, HEAD, base, revisiones y checks antes de cada
merge público. Las fusiones se ejecutaron con `gh pr merge --merge
--match-head-commit`, sin omitir protecciones ni borrar ramas. #6 conserva los
padres `6c3a742` y `acba280`; #7 conserva `fe2f39d` y `a5810a2`.
Main local avanzó exclusivamente por fast-forward.

Main tiene árbol `ad029248b4b9e7eed0461aed147edc2d123e4ca1`, idéntico al ya
desplegado. El merge `24b2c2e` que incorporó main a H5 tiene el mismo árbol que
`252f694`, revisión H5 probada; las únicas ediciones siguientes son estos dos
informes. No se repitieron las suites amplias por cambios de historial y
documentación; se repitieron las 31 pruebas de frontend antes de #7 y los
controles oficiales de salud al cierre. Los resultados anteriores corresponden
al mismo código ejecutable.

No hay cambios nuevos respecto al código H4/documental ya ejecutado en las
imágenes habituales. H5 sigue fuera de esas imágenes y deshabilitado. Por ello
la consolidación Git no requiere build/recreación ni cambio de etiquetas OCI:
la revisión `697621e` de la imagen desplegada sigue describiendo su fuente real.

## Evidencia privada local

`.local/h5-consolidation-20261119/` contiene manifiestos, patch del checkout previo,
logs Spring/H5/HTTP/Chromium/salud, snapshots antes/después y resultado de
preservación. No se publican logs, tokens, credenciales ni el PDF original en el PR.
Las capturas de las pruebas permanecen en la caché del worktree H4 integrado.

El cierre autorizado tiene evidencia adicional en
`.local/h5-consolidation-final-20261119/`: merges/HEAD esperados, descripción de
#7 actualizada, prueba frontend repetida, salud y snapshots de preservación.

El estado Git consolidado y el acuerdo pendiente con ML están detallados en
[H5_B_IMPLEMENTACION.md](H5_B_IMPLEMENTACION.md).
