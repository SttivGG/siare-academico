# Fase 2: documentos académicos

La materia incorpora carga de originales, extracción de texto, consulta y descarga autenticada. El flujo usa Spring como dueño de los archivos, MongoDB/GridFS como almacenamiento y Flask como procesador interno. Se conservan los módulos y las pruebas de Fase 1.

## Uso

1. Ejecuta `scripts/Initialize-Phase2.ps1` sobre tu `.env` existente. Añade una credencial interna independiente y conserva las credenciales anteriores. `Start-Siare.ps1` también ejecuta esta preparación.
2. Inicia la composición con `scripts/Start-Siare.ps1`.
3. Abre una materia activa en `http://127.0.0.1:3100/materias`.
4. En **Documentos de la materia**, selecciona un archivo o arrástralo al área de carga. Pulsa **Subir documento**.
5. Cuando aparezca como **Cargado**, pulsa **Procesar**. Puedes salir de la página: Spring continúa el trabajo.
6. La lista actualiza el estado mientras haya trabajos en curso. **Ver texto** muestra el contenido por página, diapositiva, sección o imagen. **Descargar** entrega el original.

Una extracción fallida conserva el archivo y muestra **Reintentar procesamiento**. Archivar la materia permite seguir consultando documentos, texto y originales; impide cargas y procesamiento.

## Formatos y límites

| Entrada | Extracción | Restricciones |
| --- | --- | --- |
| PDF | pypdf, por página | Hasta 500 páginas; un PDF escaneado sin texto produce `NO_EXTRACTABLE_TEXT`. |
| DOCX | python-docx, por sección | Incluye párrafos y texto de tablas del cuerpo. |
| PPTX | python-pptx, por diapositiva | Incluye cuadros de texto, tablas y grupos. |
| JPG, JPEG, PNG | Pillow y Tesseract `spa` | Hasta 4 millones de píxeles; imagen vacía de texto produce `NO_EXTRACTABLE_TEXT`. |

El límite inicial es 15 MiB (15 728 640 bytes). `DOCUMENT_MAX_BYTES` configura el mismo límite en Spring, Flask y el BFF. `DOCUMENT_REQUEST_MAX_BYTES` limita el multipart completo; su valor inicial añade 128 KiB al archivo. Al cambiar el límite, ajusta ambas variables y reconstruye/recrea los servicios afectados. La interfaz consulta el límite al servidor.

Spring valida nombre, tamaño observado, extensión, MIME declarado y estructura real antes de guardar. Un MIME genérico `application/octet-stream` pasa a la validación estructural; el servidor determina el MIME definitivo. DOC y PPT antiguos producen HTTP 415 con un mensaje explícito. Los documentos Office cifrados y PDF protegidos se rechazan. Las descargas usan `attachment`, `nosniff` y `no-store`.

Los paquetes Office admiten hasta 1000 entradas, 16 MiB por entrada, 48 MiB expandidos y una relación máxima de compresión de 100:1. Se comprueban CRC, XML sin DTD/entidades externas, tipos de contenido y relación al documento principal. Se rechazan rutas inseguras, duplicados, macros, ActiveX y objetos incrustados. Se permite el binario de configuración de impresora que incluyen los PPTX normales; se trata como bytes y no se interpreta. Los hipervínculos externos se conservan como texto; ningún parser los visita. Spring también inspecciona acciones y contenido activo de PDF.

La extracción tiene un máximo de un millón de caracteres, 2000 fragmentos y 60 000 caracteres por fragmento. Un proceso Python separado ejecuta cada parser, con 25 segundos de tiempo total y 12 segundos para Tesseract. En Linux tiene límites adicionales de CPU, espacio de direcciones y tamaño de archivos temporales. Los archivos temporales se eliminan al terminar la petición. Una terminación forzada del contenedor puede dejar temporales hasta que se recree el contenedor.

## API pública

Todas las rutas requieren JWT RS256 válido. Spring comprueba la propiedad de la materia antes de acceder al almacenamiento o reservar el procesamiento. El formato de error conserva `timestamp`, `status`, `code`, `message` y `fields` de Fase 1.

| Método | Ruta | Resultado |
| --- | --- | --- |
| POST | `/api/v1/subjects/{subjectId}/documents` | Multipart con un campo `file`. HTTP 201 y metadatos `UPLOADED`. |
| GET | `/api/v1/subjects/{subjectId}/documents` | Array de documentos propios, más recientes primero. |
| GET | `/api/v1/documents/{documentId}` | Metadatos y estado actual. |
| GET | `/api/v1/documents/{documentId}/download` | Streaming del original desde GridFS. |
| POST | `/api/v1/documents/{documentId}/process` | Reserva el trabajo; HTTP 202 si está en curso. |
| GET | `/api/v1/documents/{documentId}/text` | Texto y fragmentos; HTTP 409 mientras no esté `READY`. |

Ejemplo de metadatos públicos:

```json
{
  "documentId": "7edd37a3-92d4-40c4-b188-1977075f9c93",
  "subjectId": "7f17fc01-684c-466c-bc87-71facf315053",
  "originalFilename": "apuntes.pdf",
  "contentType": "application/pdf",
  "sizeBytes": 1024,
  "checksum": "sha256-hexadecimal-de-64-caracteres",
  "status": "UPLOADED",
  "createdAt": "2026-11-10T17:00:00Z",
  "processedAt": null,
  "errorCode": null,
  "operationId": null,
  "leaseUntil": null
}
```

El backend conserva `ownerId` y `gridfsId` exclusivamente en sus registros internos. Un UUID ajeno no concede acceso: la API responde 403 y no abre el archivo. Un UUID inexistente produce 404; un UUID malformado, 400.

## Trabajo, reintentos y concurrencia

Spring devuelve el control tras reservar `PROCESSING`. Un ejecutor local admite un trabajo activo y dos en espera. MongoDB realiza la reserva mediante `findOneAndUpdate`, con una vigencia de 120 segundos y un UUID de operación. La vigencia cubre los dos trabajos anteriores de la cola y el timeout HTTP de 35 segundos del tercero.

`Idempotency-Key: <UUID>` es opcional. Repetir el UUID vigente devuelve su estado; no vuelve a programar el trabajo. Un documento `READY` devuelve su resultado actual. Para reintentar un fallo se usa otro UUID; el cliente incluido deja que Spring lo genere. Un trabajo con reserva vigente tampoco se programa otra vez. Una cola llena produce `PROCESSOR_BUSY`, conserva el original y permite reintentar.

Un reinicio conserva `PROCESSING` en MongoDB. Pasados los 120 segundos de reserva, el usuario puede reintentarlo. Esta fase no incluye una cola distribuida ni recuperación automática de trabajos tras reiniciar. El frontend muestra cuándo una reserva ha vencido.

La JVM de Spring no conserva respuestas DNS negativas y limita las positivas a cinco segundos. Así puede resolver de nuevo el nombre `content-ai` al recuperar o recrear su contenedor. Este ajuste se aplica al proceso Java de SIARE y no modifica la red de Windows ni WSL.

Cada fragmento contiene el UUID de operación. Spring publica `READY` solo después de guardar los fragmentos y comprueba que sigue siendo dueño de la reserva. Un worker atrasado no puede publicar sobre otra operación. Si se pierde una confirmación de MongoDB, se conservan los fragmentos para evitar borrar contenido que ya pudiera estar publicado; un reintento exitoso retira los de operaciones anteriores.

Si falla la inserción de metadatos después de almacenar en GridFS, Spring intenta eliminar ese archivo. Si MongoDB también impide la compensación, pueden quedar archivos huérfanos. Su limpieza requiere reconciliar GridFS con los metadatos después de recuperar la base; esta fase no incluye un recolector automático y no depende de transacciones con MySQL.

## Contrato interno con Flask

`POST http://content-ai:5000/internal/v1/extractions` recibe el cuerpo binario original, su MIME canónico, `X-Document-Type` (`PDF`, `DOCX`, `PPTX`, `JPEG` o `PNG`) y `X-Operation-Id` UUID. Spring envía `Authorization: Bearer <CONTENT_SERVICE_TOKEN>`. Flask compara esa credencial en tiempo constante. No acepta URL, usuario, materia ni identificador GridFS para buscar archivos.

Respuesta HTTP 200:

```json
{
  "operationId": "9e724d57-3405-4889-a572-ce043d579a01",
  "result": {
    "fileType": "PDF",
    "text": "Contenido académico",
    "fragments": [{"index": 0, "unitType": "page", "unitNumber": 1, "text": "Contenido académico"}],
    "unitCount": 1,
    "warnings": [],
    "extractionStatus": "READY"
  }
}
```

Un fallo devuelve `{"operationId":"...","errorCode":"NO_EXTRACTABLE_TEXT"}` con HTTP 422; la saturación devuelve 503. La ausencia de credencial produce 401. Spring limita la respuesta a 8 MiB, valida operación, tipo, índices, tamaños y correspondencia entre texto y fragmentos. Un error de conexión, timeout o contrato inválido marca `FAILED` con `PROCESSOR_UNAVAILABLE`. Flask solo reside en la red interna `data`, sin puerto publicado.

## Colecciones

| Colección | Contenido e índices |
| --- | --- |
| `fs.files` | Registro GridFS del original y MIME; `_id` ObjectId. |
| `fs.chunks` | Fragmentos binarios administrados por el driver GridFS. |
| `document_metadata` | UUID de documento, materia y propietario; referencia GridFS; nombre, MIME, tamaño, SHA-256, fechas, estado, error y reserva. Índice por propietario/materia/fecha/UUID e índice de estado/vencimiento. |
| `document_fragments` | Texto, índice de fragmento, tipo/número de unidad y UUID de documento/operación. Índice único `(documentId, operationId, index)`. |

El archivo binario solo vive en GridFS. El texto completo se reconstruye desde los fragmentos ordenados; los metadatos conservan el resumen de la extracción. Los índices se crean durante el arranque de Spring.

## BFF y navegador

Las operaciones JSON documentales pasan por la lista de rutas permitidas de `/api/bff/[...path]`. Su límite de mutaciones sigue siendo 16 KiB. Los archivos usan `/api/files/subjects/{subjectId}/documents` y `/api/files/documents/{documentId}/download`.

La carga exige cookie HttpOnly, origen exacto, `X-SIARE-CSRF: 1`, contexto de navegación permitido y un boundary multipart válido. El BFF escribe el stream a un archivo temporal con límite de bytes observados y timeout; después lo transmite a Spring. La descarga transmite el stream de Spring, limita sus bytes y conserva los encabezados de adjunto y `nosniff`. El JWT solo se añade desde el servidor. El navegador no recibe tokens ni direcciones internas.

## Pruebas reproducibles

```powershell
# Con Docker Desktop disponible y WSL actualizado:
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Siare.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-Phase2.ps1 -SimulatePythonOutage -RestartContainers
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-Phase1.ps1
Push-Location .\frontend
npm.cmd test
npm.cmd run build
npm.cmd run typecheck
npm.cmd run test:e2e
Pop-Location
```

`Test-Phase2.ps1` genera fixtures sintéticos con las bibliotecas del contenedor y los copia a `.cache/phase2-fixtures`. Comprueba los seis formatos, bytes y SHA-256 del original, texto, errores, autenticación, accesos ajenos, el BFF y materias archivadas. Los modificadores detienen solo Flask para probar el fallo/reintento y reinician la composición para comprobar persistencia de GridFS, metadatos, fragmentos, JWT y cookie. El wrapper verifica primero la identidad de los recursos. Conserva las cuentas `@example.test` y sus archivos.

El Dockerfile Flask ejecuta las pruebas con Tesseract español real. En Windows, `python -m unittest discover -s tests -v` omite explícitamente esa prueba si `SIARE_REAL_OCR` no está activo; las pruebas unitarias de imágenes verifican por separado la llamada OCR y el resultado vacío. Las suites Java y frontend conservan las pruebas previas. Playwright incorpora carga, extracción, texto y descarga en escritorio y móvil.

Consulta [VALIDATION.md](VALIDATION.md) para distinguir las comprobaciones ejecutadas de las que siguen pendientes en el entorno.

## Archivos del módulo

La entrega contiene 44 archivos nuevos y 19 modificados (63 en total), sobre la rama `feature/fase2-documentos`, sin commit ni push.

| Área | Archivos añadidos |
| --- | --- |
| Dominio Java `domain/document/` | `DocumentMetadata.java`, `DocumentStatus.java`, `DocumentType.java`, `DocumentRules.java`, `DocumentException.java`, `ExtractedContent.java`. |
| Puertos de entrada Java | `UploadDocumentUseCase.java`, `ListDocumentsUseCase.java`, `GetDocumentUseCase.java`, `DownloadDocumentUseCase.java`, `ProcessDocumentUseCase.java`. |
| Puertos de salida Java | `DocumentRepository.java`, `DocumentStorage.java`, `DocumentValidator.java`, `DocumentProcessor.java`. |
| Aplicación Java | `application/service/DocumentService.java`. |
| Infraestructura Java | `adapter/in/web/DocumentController.java`, `adapter/out/document/{GridFsDocumentStorage,MongoDocumentRepository,StructuralDocumentValidator,HttpDocumentProcessor,BoundedResponseSubscriber}.java`, `config/DocumentConfiguration.java`. |
| Pruebas Java | `TestDocumentsConfiguration.java`, `DocumentServiceTests.java`, `DocumentValidationTests.java`, `DocumentApiTests.java`, `DocumentProcessorHttpTests.java`. |
| Flask | `app/controllers/extraction_controller.py`, `app/models/{extraction,extraction_model,extraction_worker}.py`, `app/views/extraction_view.py`, `tests/{fixture_factory,test_extraction}.py`. |
| Next.js | `src/app/api/files/[...path]/route.ts`, `src/lib/document-policy.ts`, `src/components/subject-documents.tsx`, `tests/document-policy.test.mjs`, `tests/e2e/phase-two.spec.ts`. |
| Operación/documentación | `scripts/Initialize-Phase2.ps1`, `scripts/Test-Phase2.ps1`, `scripts/test-phase2.mjs`, `docs/PHASE2.md`. |

Se modificaron `README.md`, `docs/ARCHITECTURE.md`, `docs/VALIDATION.md`, `.env.example`, `compose.yaml`, `scripts/{Initialize-Siare,Start-Siare}.ps1`, el POM y `application.properties` de Spring, `SiareCoreApplication.java`, `ApiExceptionHandler.java`, el Dockerfile y `.dockerignore` de Flask, sus requirements y fábrica de aplicación, y el CSS, política de rutas y espacio de materia del frontend. No se cambiaron contratos Abstract Factory, credenciales existentes ni esquemas MySQL.
