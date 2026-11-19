# Compatibilidad documental y procesamiento aislado

Fecha del trabajo: 18 de noviembre de 2026, America/Bogota.

## Diagnóstico

El original `Guia_Estudio_MongoDB_Aggregate_Solucionario.pdf` tiene 385.884 bytes, 13 páginas y SHA-256 `66cdd9f6cd895d4837cd68aa1208d89ca4bf4b9760e2c24e54cbf9e76815735e`. Se utilizó la copia local de solo lectura `.cache/pdf-diagnosis/original.pdf`; el documento no se incorpora a Git.

Había dos rechazos independientes: el validador Spring bloqueaba asociaciones PDF; Flask también rechazaba cualquier `/EmbeddedFiles`. El diagnóstico anterior distinguía C2PA mediante un error `PROVENANCE_UNVERIFIED`, pero todavía exigía verificar firmas para admitir el archivo. Ese comportamiento no resolvía la compatibilidad. La descarga, además, permitía recuperar archivos sin haber completado su evaluación y el OCR solo cubría imágenes independientes.

La reproducción sobre la imagen anterior de Flask, sin red y con límites, devolvió `UNSAFE_DOCUMENT`. El original contiene un stream JUMBF de 24.300 bytes, sin filtro de compresión. El reconocimiento de su estructura **no verifica su firma, vínculo con el PDF, identidad del firmante ni confianza**. La separación entre almacenamiento JUMBF y verificación se basa en la [especificación C2PA](https://spec.c2pa.org/specifications/specifications/2.2/specs/C2PA_Specification).

## Flujo implementado

1. Spring autoriza al estudiante y la materia; verifica nombre, formato declarado y tamaño observado. Crea una copia temporal desde una sola lectura del proveedor, calcula SHA-256 y comprueba una envoltura binaria mínima, sin interpretar PDF, ZIP ni imágenes en la petición HTTP.
2. GridFS recibe exactamente esa copia. Los metadatos conservan tamaño, checksum y propietario; nunca incluyen el binario. El original, su actualización incremental, C2PA y firmas se conservan sin reescritura.
3. `UPLOADED`, `PROCESSING` y `FAILED` son estados privados de cuarentena. La descarga requiere autorización y `READY`; las consultas de texto también requieren `READY`. No se agrega un estado incompatible al contrato existente.
4. Antes de enviar bytes a Flask, Spring vuelve a comprobar tamaño y SHA-256 de GridFS. Una discrepancia produce `CHECKSUM_MISMATCH`, sin llamar al extractor ni publicar texto.
5. Flask recibe bytes, tipo y operación por el contrato interno existente. Un worker desechable evalúa estructura y extrae únicamente contenido de páginas, diapositivas, secciones o imágenes. No recibe URL, identificadores de GridFS ni credenciales de usuario/base de datos.
6. Mongo publica texto y fragmentos por operación solo al completar el proceso. Las advertencias usan el campo `warnings` existente. C2PA produce `PROVENANCE_UNVERIFIED` y `ASSOCIATED_FILES_IGNORED`; son advertencias de un resultado `READY`.
7. React representa texto escapado y fragmentos identificados por página, diapositiva, sección o imagen. No monta el PDF original en `iframe`, `object`, visor PDF ni HTML arbitrario. La descarga de un original procesado conserva `attachment`, `nosniff` y `no-store`; el endpoint Spring añade CSP restrictiva.

`StructuralDocumentValidator.validateForStorage` es la admisión a almacenamiento privado. `validate` conserva el diagnóstico estructural estricto para pruebas/herramientas; no es el analizador usado por el endpoint de carga. El análisis de procesamiento corresponde al worker Flask.

## Política de asociaciones PDF

Se recorren el catálogo, tráiler, referencias actuales, objetos no alcanzables y object streams. Se bloquean scripts, acciones automáticas, formularios activos, RichMedia, acciones remotas, streams externos y URI con esquemas peligrosos. La detección activa precede a la clasificación de asociaciones.

No basta un nombre, extensión, MIME o etiqueta C2PA. El worker comprueba relaciones entre Filespec y streams y clasifica bytes con límites. Admite contenedores JUMBF C2PA estructuralmente reconocibles y datos inertes de formatos acotados: JSON completo, XML sin DTD/entidades/recursos activos y PNG/JPEG verificados. No admite HTML, SVG, ejecutables, scripts, archivos comprimidos ni documentos anidados como asociaciones. Los desconocidos impiden `READY` y permanecen en cuarentena sin descarga ni vista previa.

La inspección de asociaciones ocurre exclusivamente en memoria limitada. No se exportan archivos asociados, no se ejecutan, no se incorporan al texto de estudio y no se entregan al OCR. Solo se admite compresión de asociación sin filtro o Flate con descompresión incremental acotada. El límite conjunto es 256 KiB y ocho asociaciones. Los contenedores JUMBF tienen límites de profundidad y cantidad de cajas; no se interpretan CBOR, firmas ni afirmaciones de procedencia.

## Aislamiento y límites

- Linux amd64/arm64, usuario sin privilegios y `no_new_privs`; si no se pueden instalar Landlock ABI 3 o superior y seccomp, devuelve `SANDBOX_UNAVAILABLE` y mantiene cuarentena. ABI anteriores no protegen frente al truncado de archivos. No hay fallback sin aislamiento para Windows u otros kernels. Véase la [documentación del kernel sobre Landlock](https://docs.kernel.org/userspace-api/landlock.html).
- Landlock permite leer programa/bibliotecas, fuente del trabajo y recursos de OCR. Impide leer `/proc` o estado de otros procesos y limita las escrituras al directorio temporal del trabajo; ese directorio no permite ejecución.
- Seccomp impide sockets/conexiones y acceso de inspección a otros procesos. Las restricciones se heredan al renderizador y Tesseract.
- Entorno de worker construido con una lista explícita; no hereda token de servicio, contraseñas ni descriptores del servidor.
- Un trabajo simultáneo, plazo de 25 s y terminación del grupo completo; CPU 20 s, espacio de direcciones 384 MiB, archivo individual 8 MiB y 64 descriptores. `RLIMIT_NPROC=256` cuenta todos los hilos del UID incluso en otros contenedores; el límite efectivo del servicio se aplica con el cgroup de 64 tareas. Un límite por UID de 32 impedía crear Tesseract cuando coexistía con Spring y se corrigió durante la integración. El contenedor conserva límites de 256 MiB y 0,5 CPU, añade raíz de solo lectura, capacidades eliminadas y `/tmp` de 64 MiB.
- Máximo de carga 15 MiB; PDF de 500 páginas, profundidad de objetos 100, 100.000 referencias/200.000 nodos, 8 MiB por contenido de página y 48 MiB acumulados. Las asignaciones del parser anteriores a comprobaciones se contienen mediante límites del sistema operativo.
- OCR de páginas sin texto: un raster temporal de hasta 2.000 píxeles de lado/4 MP, plazo de render 8 s y Tesseract español de 12 s; sigue sujeto al plazo total. `OCR_APPLIED` avisa de posibles errores.
- Se conservan las políticas de paquetes Office, CRC, expansión ZIP, XML seguro, macros y contenido incrustado; JPEG/PNG mantienen comprobación de formato y píxeles.

La retención de cuarentena no borra originales automáticamente. No hay descarga administrativa alternativa ni ruta de previsualización del original. Este cambio no agrega un servicio de antivirus ni valida criptografía C2PA.

## Validación

Evidencia local bajo `.cache/document-compatibility/` y `.cache/pdf-diagnosis/compat-*.log`.

| Comprobación | Resultado |
|---|---|
| Maven offline `verify`, incluyendo H3, documentos, autorización, integridad, MFA y OIDC | 166 pruebas, 0 fallos y 0 errores; `BUILD SUCCESS` |
| Frontend unitario | 21 pruebas pasadas; una corresponde al diagnóstico de rutas preexistente |
| Frontend `build` y `typecheck` | Correctos |
| Flujo HTTP real en entorno dedicado | 209 comprobaciones correctas |
| Original por Spring y por BFF | Carga → cuarentena → procesamiento → READY → 13 páginas → texto → descarga idéntica a GridFS |
| Texto original y equivalente sin asociaciones | 14.115 caracteres; igualdad exacta de texto y fragmentos; SHA-256 original conservado |
| Python final, incluyendo OCR por el worker, aislamiento y original | 22 pruebas pasadas, 0 omitidas; 119,295 s |
| Imagen final Flask, pruebas del Dockerfile sin red | 22 pruebas: 21 pasadas y original omitido explícitamente por no montarse en el build; dependencias correctas |
| Chromium escritorio | Flujo completo pasado, 16,9 s |
| Chromium móvil en contenedor nuevo | Flujo completo pasado, 10,9 s |
| Comprobación JUnit directa de GridFS después del navegador | 1 prueba pasada; metadatos READY, advertencias, fragmentos y SHA-256 binario confirmados |

El ensayo HTTP verifica también PDF normal, DOCX, PPTX, PNG, JPG y JPEG, OCR de un PDF escaneado, acciones activas, adjuntos desconocidos, estructura corrupta, cifrado, tamaño excesivo, autorización cruzada y bloqueo de descarga/texto en cuarentena. Los originales de pruebas permanecen en la base dedicada mientras dure el entorno; los volúmenes de la instalación no se utilizan.

Durante la primera regresión Docker Desktop/WSL dejó de responder y produjo errores de lectura en el contenedor Java. Se recuperó el motor reiniciando Docker Desktop, sin borrar discos ni volúmenes. La repetición completa de Maven terminó correctamente. Los fallos de preparación del Mongo temporal (espacio mínimo) y del OCR (límite global por UID) se corrigieron antes de la validación integral.

Chromium necesitó `HOME`, `XDG_CONFIG_HOME` y `XDG_CACHE_HOME` dentro del `/tmp` del contenedor con raíz de solo lectura. El escritorio pasó; el renderer del perfil móvil cayó al reutilizar el navegador y el perfil móvil pasó al repetirse en un contenedor nuevo con los mismos límites. Las capturas están en `.cache/document-integration/browser/phase2-documents-desktop.png` y `phase2-documents-mobile.png`; contienen texto del documento y no se publican en Git.

Repetición de suites aisladas, usando imágenes ya construidas y caché Maven local:

```powershell
./scripts/Test-DocumentCompatibility.ps1
# Añadir -BuildProcessor para construir la imagen de Flask.
```

La suite Python debe montar `SIARE_TEST_PDF` de solo lectura. Verifica SHA-256 antes/después, 13 páginas, texto reconocible y equivalencia exacta de texto/fragmentos con una copia de prueba sin asociaciones. Esa copia se genera exclusivamente en memoria para la comparación y no reemplaza el original.

`DocumentBrowserIntegrationTests` se habilita solo con `SIARE_DOCUMENT_BROWSER=1`. Arranca Spring HTTP con H2 y claves sintéticas, MongoDB real dedicado y extractor real. Espera la señal `/scratch/browser.done` después de Playwright; entonces comprueba metadatos, fragmentos y SHA-256 directamente desde GridFS. No utiliza credenciales, redes ni volúmenes de la instalación existente.

Para preparar el navegador usado en la comprobación:

```powershell
docker build -f scripts/docker/document-browser.Dockerfile -t siare-document-browser:compat .
```

El ensayo integral usó una red `--internal`, aliases `mongo`, `content-ai`, `core-api` y `frontend`, MongoDB con `/data/db` en tmpfs de 2 GiB y 384 MiB de RAM, Flask con el token sintético constante de la clase de prueba, y frontend con `CORE_API_URL=http://core-api:8080` y `APP_ORIGIN=http://frontend:3000`. Las variables obligatorias de salud de Flask tuvieron valores sintéticos. La JVM se ejecutó offline en `maven:3.10.0-eclipse-temurin-21-alpine` con fuente/caché de solo lectura y copia en `/scratch`, mediante `mvn -o -B -ntp -Daether.syncContext.named.factory=noop -Dmaven.repo.local=/m2 -Dtest=DocumentBrowserIntegrationTests test`. Antes de lanzar los clientes se comprobó `DOCUMENT_BROWSER_SERVER_READY` en su salida.

Los clientes usaron `E2E_BASE_URL=http://frontend:3000`, `SIARE_TEST_CORE_URL=http://core-api:8080/api/v1/` y `SIARE_TEST_PDF=/input.pdf` montado de solo lectura. Playwright se lanzó con `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`, primero `node node_modules/@playwright/test/cli.js test tests/e2e/phase-two.spec.ts` y después `--project=mobile` en un contenedor nuevo. El contenedor de navegador tuvo raíz de solo lectura, capacidades eliminadas, sin privilegios nuevos, 768 MiB, 2 CPU, 128 tareas y directorios temporales de escritura; no montó `.env`, claves ni socket Docker. La señal final fue `touch /scratch/browser.done` en el contenedor de Spring.

La prueba `frontend/tests/e2e/phase-two.spec.ts`, con `SIARE_TEST_PDF`, ejercita carga, bloqueo de descarga inicial, procesamiento, `READY`, página 13, texto, advertencia de procedencia y descarga exacta. Se ejecuta en Chromium en escritorio y móvil. `scripts/test-phase2.mjs` admite `SIARE_TEST_CORE_URL` y `E2E_BASE_URL` para comprobar formatos, autorización, cuarentena y el original por Spring y BFF en la red dedicada.

## Alcance y límites conocidos

No se modifica React Native, modelos ML, analítica, credenciales, MFA/OIDC ni migraciones históricas. H3 queda en la base de la rama correctiva y mantiene sus pruebas. Los endpoints, enumeraciones y formas JSON se conservan; descargar un documento que todavía no está `READY` pasa a responder `409 DOCUMENT_QUARANTINED` por la política solicitada.

La representación de estudio es texto organizado por páginas/fragmentos; no ofrece un facsímil gráfico del documento. Los PDF escaneados grandes o complejos pueden quedar en cuarentena por el plazo total. Asociaciones de otros formatos o C2PA fuera de los límites definidos requieren ampliar la clasificación y sus pruebas, sin abrir un permiso general. La procedencia sigue sin verificar.

Los cambios de diagnóstico de rutas y su documento anterior ya estaban presentes al comenzar. Se conservan en el árbol de trabajo; este informe reemplaza la conclusión anterior de que C2PA requería verificación criptográfica para estudiar el contenido.

Consulté la skill `modern-web-guidance` para avisos de validación. La copia offline no estaba disponible y la revisión automática rechazó descargar/ejecutar `npx -y` por el riesgo de código externo; no se recuperó ninguna guía. Los cambios de interfaz conservan el escape de React y los patrones accesibles existentes y se comprobaron con tipos, pruebas y Chromium.

## Archivos de la corrección

- Spring: `DocumentValidator`, `StructuralDocumentValidator`, `DocumentService`, `HttpDocumentProcessor`, `DocumentController`; pruebas `DocumentServiceTests`, `DocumentApiTests`, `DocumentProcessorHttpTests`, `PdfSecurityTests`, `OriginalPdfValidationTests` y `DocumentBrowserIntegrationTests`.
- Flask: `extraction.py`, `extraction_model.py`, `extraction_worker.py`, nuevos `pdf_policy.py` y `parser_sandbox.py`; `fixture_factory.py`, `test_extraction.py`, nuevo `test_pdf_policy.py` y Dockerfile.
- Frontend: `subject-documents.tsx`, `document-policy.ts`, su prueba unitaria y `phase-two.spec.ts`.
- Operación y documentación: `compose.apps.yml`, `scripts/test-phase2.mjs`, `Test-DocumentCompatibility.ps1`, `scripts/docker/document-browser.Dockerfile`, `docs/PHASE2.md`, descripción de descarga en `docs/openapi.json` y este informe.

La base del PR es `feature/core-actividades`, que contiene H3; así el diff correctivo no vuelve a proponer H3 ni lo elimina. Los cambios de rutas BFF y el diagnóstico anterior no forman parte de esta corrección y permanecen sin commit.
