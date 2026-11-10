# Decisiones de arquitectura

## Hexágono Java

`domain` contiene modelos y contratos Java puros. `application` declara puertos de entrada/salida y servicios de aplicación sin anotaciones Spring. `infrastructure` implementa los adaptadores HTTP, Actuator y la composición de objetos con beans. Las dependencias apuntan hacia el dominio.

El flujo implementado es `HealthController -> CheckHealthUseCase -> CheckHealthService -> ReadinessPort -> ActuatorReadinessAdapter`. El adaptador consulta el agregado real de salud de Actuator, incluidos JDBC y MongoDB. El controlador transforma el resultado en HTTP 200/503 sin revelar componentes. La configuración Spring queda fuera de domain/application.

La ubicación, Java 21 y Spring Boot 4.1.2 originales se conservan. El POM incorpora el starter Flyway y `flyway-mysql`, gestionados por Boot, y H2 con alcance test. El perfil de pruebas ejecuta la misma migración en H2 y usa claves de prueba efímeras; las pruebas de seguridad recorren los filtros reales.

`AccountController` y `SubjectController` invocan `AccountUseCase` y `SubjectUseCase`. `AccountService` y `SubjectService` dependen de puertos de repositorio, contraseña, token y un reloj Java. Los adaptadores JPA convierten entidades de infraestructura a modelos del dominio. Los controladores convierten los resultados a DTOs y no serializan entidades JPA ni hashes.

`SubjectService` comprueba al propietario antes de leer, editar o archivar. El listado consulta exclusivamente por propietario. PATCH distingue una descripción omitida de `null`, que la elimina; el nombre omitido se conserva. Archivar es idempotente y preserva los datos; una materia archivada admite consulta pero no edición.

Flyway aplica `V1__users_and_subjects.sql` sobre el MySQL existente. El correo normalizado tiene una restricción UNIQUE que resuelve también registros concurrentes. `saveAndFlush` permite transformar esa colisión en HTTP 409. Hibernate usa `validate`, no modifica tablas; las fechas se generan y persisten en UTC.

## Seguridad de Fase 1

Spring Security 7 usa OAuth2 Resource Server y `NimbusJwtDecoder` con la clave pública local, algoritmo RS256 explícito y validadores de emisor y tiempo. Se requieren `sub` UUID, `iat` y `exp`; el vencimiento no tiene tolerancia adicional. `NimbusJwtEncoder` firma con RS256. El plazo por defecto es `PT30M`, configurable con `JWT_TTL`. El registro usa BCrypt con coste 12 y limita la contraseña a 72 bytes UTF-8 para evitar truncamientos.

`Initialize-SiareKeys.ps1` genera RSA 3072 únicamente si no existe el par en el volumen `jwt-keys`. El volumen tiene la identidad de esta instancia, vive fuera del repositorio y Spring lo monta en modo lectura. Sus archivos pertenecen a UID 10001 y tienen permisos 0400. Un par incompleto falla sin sobrescribirlo. Las imágenes no incluyen claves y el runtime no genera claves efímeras.

La API es stateless y solo autentica cabeceras Bearer, por lo que desactiva CSRF en esa frontera. Solo registro, login y salud son públicos. Next.js aplica la protección CSRF donde sí hay autenticación por cookies. Los errores de seguridad usan el mismo formato que los de negocio; el 401 incluye `WWW-Authenticate: Bearer`. Las respuestas no contienen excepciones SQL, contraseñas ni tokens de diagnóstico.

## Documentos de Fase 2

`DocumentService` implementa los cinco puertos de entrada documentales mediante `SubjectUseCase`, `DocumentRepository`, `DocumentStorage`, `DocumentValidator` y `DocumentProcessor`. El dominio y la aplicación siguen siendo Java puro. Los adaptadores usan GridFsTemplate, colecciones MongoDB y HttpClient; `DocumentConfiguration` compone los objetos y un ejecutor acotado. `DocumentController` transforma los metadatos a DTOs que omiten referencias internas.

La carga valida estructura con PDFBox 3.0.7, ImageIO y parsers ZIP/XML del JDK antes de guardar. GridFS recibe el original por stream; los metadatos contienen SHA-256 y su referencia, sin duplicar el binario. Un fallo posterior de metadatos dispara una compensación sobre GridFS. MySQL sigue resolviendo propiedad de materias; esta operación no usa transacciones distribuidas.

El procesamiento es una segunda petición: MongoDB reserva `PROCESSING` con un UUID y vigencia de 120 segundos, y Spring responde HTTP 202. Un ejecutor admite un trabajo y dos en espera. El worker transmite el original a Flask con credencial interna, timeout y límite de respuesta. Los fragmentos se guardan por documento/operación y el cambio a `READY` exige conservar la reserva. Los fallos mantienen el original y admiten reintento. Una reserva interrumpida por reinicio puede reintentarse después de vencer. Los detalles del contrato, límites e índices están en [PHASE2.md](PHASE2.md).

Flask conserva MVC: el controlador valida la petición interna, el modelo ejecuta el parser en un subproceso terminable y la vista devuelve el contrato JSON. pypdf, python-docx y python-pptx extraen texto; Pillow y Tesseract español procesan imágenes. El subproceso tiene límites de tiempo/recursos. Python recibe bytes y tipo canónico; no recibe una URL o identificador para buscar documentos ni decide permisos estudiantiles. El servicio sigue sin puerto host.

El arranque de Spring configura la caché DNS de su JVM con TTL negativo cero y positivo de cinco segundos, para recuperar la resolución de los servicios Docker después de una caída. El adaptador registra solo la clase de un fallo de transporte o contrato, sin mensajes que puedan contener credenciales o documentos. Gunicorn ejecuta un worker con dos threads y desactiva su socket administrativo; no requiere un directorio home escribible.

Next mantiene la cookie HttpOnly y el límite de 16 KiB para mutaciones JSON. La carga y descarga usan rutas específicas de `/api/files`, límites sobre bytes reales y streams. El multipart pasa por un temporal acotado para poder rechazarlo antes de transmitirlo a Spring. La vista de materia conserva el estilo de Fase 1 e incorpora selección accesible, progreso, estados, reintentos y vista del texto.

## Abstract Factory de actividades: diseño pendiente de implementación

`ActivityFactory<A, S>` declara los tres métodos `createGenerator()`, `createEvaluator()` y `createFeedbackPolicy()`. Sus productos son `Generator<A>`, `Evaluator<A, S>` y `FeedbackPolicy`.

| Familia | Contrato de fábrica | Tipo de actividad | Tipo de respuesta |
| --- | --- | --- | --- |
| Quiz | `QuizFactory` | `Quiz` | `QuizSubmission` |
| Crossword | `CrosswordFactory` | `Crossword` | `CrosswordSubmission` |

Los genéricos vinculan generador y evaluador al tipo de actividad y respuesta de su familia. `FeedbackPolicy` interpreta una evaluación común. `ActivityFactoryProvider` define el futuro puerto para seleccionar la familia y `GenerateActivityUseCase` el futuro puerto de entrada.

Todo el módulo de actividades es un conjunto de contratos. No existen fábricas concretas, productos concretos, proveedor registrado, servicio de generación, endpoints, persistencia, ML ni generación de crucigramas. La coherencia semántica de las implementaciones se deberá probar cuando se construyan. No hay métodos que devuelvan contenido simulado ni excepciones de funcionalidad ficticia.

## MVC de Flask y Express

Los modelos consultan la disponibilidad de dependencias, los controladores deciden el estado HTTP y las vistas construyen JSON. Las rutas no contienen consultas de datos. Flask usa una fábrica de aplicación; Express separa creación de aplicación y proceso HTTP, permitiendo inyectar modelos de prueba sin conectar a Cassandra.

Flask hace `ping` autenticado a MongoDB y Redis con tiempos de espera acotados. Su módulo documental procesa únicamente los bytes proporcionados por Spring. Express consulta la versión en `system.local` con el driver Cassandra, sin crear keyspaces. Los modelos de progreso siguen pendientes.

## Frontend

La portada mantiene una comprobación dinámica de salud. `server-health.ts` usa `server-only` y lee `CORE_API_URL` en tiempo de petición. La consulta usa `cache: no-store`, valida `status=UP` y vence a los cinco segundos. Una respuesta inválida, HTTP no exitoso o un fallo de red produce `DOWN`.

`GET /api/health` usa el mismo flujo y devuelve 503 si no puede confirmar Spring. Registro y login usan formularios con etiquetas visibles, autocompletado, mensajes de error y estados de envío. `/inicio` y `/materias` comparten un layout que comprueba la sesión en Spring antes de mostrar el contenido. Los formularios de materias permiten crear, editar y archivar; el listado incluye filtros para activas y archivadas.

`/api/bff/[...path]` permite solo las rutas y métodos de esta fase. Intercambia el JWT de login por una cookie HttpOnly y elimina el token del cuerpo enviado al cliente. La cookie es `SameSite=Lax`, `Secure` y con prefijo `__Host-` en HTTPS; el Compose HTTP local configura una excepción explícita. El BFF exige `Origin` igual a `APP_ORIGIN`, `Content-Type: application/json`, cabecera `X-SIARE-CSRF: 1` y ausencia de un contexto `cross-site` en mutaciones. No acepta cabeceras Authorization del navegador ni reenvía cookies a Spring. Limita las peticiones a 16 KiB, evita caché y acota las consultas a diez segundos.

El cierre de sesión elimina la cookie. Un JWT copiado conserva su validez hasta la expiración; esta fase no incluye refresh tokens ni revocación. La interfaz usa fuentes del sistema, colores neutros con un acento verde provisional y reglas responsive. No pretende reproducir Nexo sin referencias.

## Despliegue local

Los cuatro servicios de aplicación usan Dockerfiles multi-stage y procesos sin root en runtime. No se copian archivos `.env` a los contextos de build. El build Next funciona sin acceso a una API Spring activa; las peticiones se resuelven en runtime.

Las imágenes externas se fijaron por versión y digest del manifiesto multi-plataforma consultado en Docker Hub. Para actualizar una imagen, revisa la nueva versión, sustituye versión y digest juntos, reconstruye y ejecuta `Test-Siare.ps1`. La configuración Cassandra usa nombres y unidades de `cassandra.yaml` 4.1.12. No hay integración automática con servicios Windows/WSL2 preexistentes.

## Referencias oficiales consultadas

- [Spring Boot: endpoints, exposición y seguridad de Actuator](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html).
- [Spring Security: validación JWT y algoritmos de firma](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html).
- [Spring Security 7: NimbusJwtEncoder](https://docs.spring.io/spring-security/reference/7.0/api/java/org/springframework/security/oauth2/jwt/NimbusJwtEncoder.html).
- [Flyway: dependencia de soporte MySQL](https://documentation.red-gate.com/flyway/reference/database-driver-reference/mysql).
- [Spring Boot: propiedades, incluida la configuración `spring.mongodb.*` de Boot 4](https://docs.spring.io/spring-boot/appendix/application-properties/index.html).
- [Flask: despliegue Gunicorn en Linux](https://flask.palletsprojects.com/en/stable/deploying/gunicorn/).
- [Cassandra: configuración oficial de la versión 4.1.12](https://github.com/apache/cassandra/blob/cassandra-4.1.12/conf/cassandra.yaml).
- [Next.js: despliegue standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
- [Docker Compose: dependencias y condiciones de salud](https://docs.docker.com/compose/how-tos/startup-order/).
- [Docker Hub: imágenes oficiales](https://hub.docker.com/u/library) y los registros npm/PyPI para comprobar las versiones fijadas.
- [GridFsTemplate: almacenamiento y recuperación por stream](https://docs.spring.io/spring-data/data-mongodb/docs/current/api/org/springframework/data/mongodb/gridfs/GridFsTemplate.html).
- [Apache PDFBox: versión 3.0.7](https://pdfbox.apache.org/download).
- [pypdf: extracción de texto](https://github.com/py-pdf/pypdf/blob/main/docs/user/extract-text.md).
- [python-docx: texto](https://python-docx.readthedocs.io/en/latest/user/text.html) y [python-pptx: cuadros de texto](https://python-pptx.readthedocs.io/en/stable/user/text.html).
- [pytesseract: OCR, idioma y timeout](https://pypi.org/project/pytesseract/).
