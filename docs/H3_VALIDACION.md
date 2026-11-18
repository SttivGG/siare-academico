# Validación H3

Fecha: 18/11/2026, zona America/Bogota. Rama `feature/core-actividades`, creada desde main `035d74e1e953573c24b9f1371cf604ce62b1a98b`. El [PR #4](https://github.com/SttivGG/siare-academico/pull/4) estaba abierto al iniciar; no se fusionó ni modificó. Esta rama aplica los nombres de su propuesta de eventos sin incorporar su commit documental.

## Alcance entregado

| Área | Archivos principales |
| --- | --- |
| Dominio | `domain/activity/ActivityBank`, `ActivityRules`, `GenerationRequest`, `Evaluation`, `SavedActivity`, `AttemptResult`, `AttemptEvent`; modelos y productos en `quiz/` y `crossword/` |
| Abstract Factory | `BankQuizFactory`, `GridCrosswordFactory`, `RegisteredActivityFactories`, `GenerateActivityService`; evolución de los contratos existentes |
| Aplicación | `ActivityUseCase`, `ActivityService`, `ActivityViews`; puertos `ActivityRepository`, `StructuredActivityContent`, `AttemptOutbox`, `AttemptEventPublisher`; `AttemptOutboxDispatcher` |
| Adaptadores | `ActivityController`, manejo de `ActivityException`, `JsonStructuredActivityContent`, `AcademicActivityEntity`, `JpaAcademicActivities`, `AcademicActivityAdapter`, `JdbcAttemptOutbox` |
| Composición | `ActivityConfiguration`, `AttemptDeliveryMaintenance` |
| Esquema | [V5__academic_activities.sql](../services/core-api/siare-core/src/main/resources/db/migration/V5__academic_activities.sql) |
| Pruebas | `ActivityFactoryTests`, `ActivityApiTests`, `ActivityMigrationTests`, `ActivityRestartTests`, `ActivityFixtures`; [Test-H3.ps1](../scripts/Test-H3.ps1) |
| Contrato y guía | [OpenAPI](openapi.json), [H3_ACTIVIDADES.md](H3_ACTIVIDADES.md), [ejemplos](examples/h3/quiz.json), [arquitectura](ARCHITECTURE.md), [README](../README.md) |

Las rutas nuevas son POST/GET `/api/v1/subjects/{subjectId}/activities`, GET `/api/v1/activities/{activityId}`, POST `/api/v1/activities/{activityId}/submissions` y GET `/api/v1/activities/{activityId}/submissions/{attemptId}`. Las pruebas recorren los filtros Bearer reales con sesiones persistidas y autorización de materia.

## Reproducción

Con JDK 21, Maven y Docker disponibles:

```powershell
./scripts/Test-H3.ps1
# Con dependencias ya resueltas en un repositorio local:
./scripts/Test-H3.ps1 -Offline -MavenRepository 'D:/ruta/cache/m2'
```

El script ejecuta Maven `verify` con H2, crea un MySQL 8.4.13 temporal con imagen fijada por digest y almacenamiento tmpfs, corre las pruebas H3 y abre una segunda JVM para recuperar la actividad, resultado y evento anterior. Valida el nombre de base `siare_h3_test`; no lee `.env` ni conecta a los volúmenes o red de las aplicaciones. El puerto temporal se publica solo en loopback (13316 por defecto). Si está ocupado, se puede pasar `-MysqlPort 13317`. `-SkipVerify` repite únicamente MySQL y reinicio de JVM.

Al terminar, retira únicamente el contenedor que creó, comprobando su etiqueta de ejecución. Los logs se guardan en `.cache/h3-verify.log`, `.cache/h3-mysql.log` y `.cache/h3-restart.log`, y los ejemplos en `.cache/h3-examples/`. Son artefactos locales ignorados por Git. `ActivityRestartTests` lleva tag `real-stores` y se ejecuta explícitamente; no forma parte del verify H2 ordinario.

## Casos cubiertos

| Grupo | Comprobaciones |
| --- | --- |
| Fábricas | Proveedor por familia, tres clases concretas distintas por familia, rechazo de registro duplicado |
| Quiz | Banco revisado, IDs estables, opciones identificadas, material insuficiente, respuestas correctas/incorrectas/omitidas, puntuación parcial y total |
| Crucigrama | Intersecciones compatibles, ambas direcciones, conectividad, numeración y límites; rechazo de palabras sin cruces y palabras demasiado largas |
| Español | Tildes, representación Unicode compuesta/descompuesta y distinción Ñ/N |
| API/seguridad | Bearer obligatorio en las cinco operaciones, sesión revocada, materia ajena en creación/listado/consulta/envío/resultados |
| Privacidad | Claves, soluciones y citas privadas ausentes de creación/consulta; soluciones disponibles solo después de enviar; eventos sin respuestas ni textos |
| Autoridad | Rechazo de studentId, score, attemptId y eventId enviados por el cliente |
| Documentos | Propietario ajeno, documento de otra materia propia, no READY, texto vacío, JSON estructurado válido y cita verificable; rechazo de texto libre/cita sin respaldo |
| Persistencia | Consulta posterior y paginación; archivo conserva lecturas e impide nuevos intentos; V4 a V5 conserva usuario y materia previos |
| Idempotencia | Reintentos iguales y cambio del orden de claves devuelven mismo resultado; cambio de respuestas/duración devuelve conflicto |
| Concurrencia | Seis envíos simultáneos con una clave producen un intento/evento; dos claves concurrentes conservan resultados distintos |
| Transacción | Fallo inducido después de insertar intento y outbox revierte ambos |
| Recuperación | Fallo de publicador deja evento pendiente; lease impide doble reserva, vence tras caída y admite recuperación; worker antiguo no revierte entrega; segunda JVM recupera datos confirmados |
| Regresión | Suites existentes de autenticación, sesiones/RBAC, MFA/recuperación, OIDC controlado, materias, documentos, salud y migraciones |

## Resultados y límites de evidencia

Ejecución final de `Test-H3.ps1 -Offline -MavenRepository <cache local>` con Temurin 21.0.13+9 y Maven 3.10.0 en Windows:

| Comprobación | Resultado |
| --- | --- |
| Maven verify, H2 aislado | BUILD SUCCESS; 155 pruebas, 0 fallos, 0 errores, 0 omitidas |
| MySQL 8.4.13 aislado | BUILD SUCCESS; 19 pruebas H3, 0 fallos/errores |
| Segunda JVM sobre el mismo MySQL | BUILD SUCCESS; 1 prueba, recupera actividad, resultado y evento PENDING |
| Migración V4 a V5 | Conserva hash del usuario y nombre de materia existentes; validación Flyway correcta |
| Test-Siare.ps1 | 9 servicios healthy, 5 consultas autenticadas correctas, salud HTTP y frontend hacia Spring correctos |
| OpenAPI | 46 rutas, 52 operaciones y 471 referencias resueltas; operaciones y esquemas previos sin cambios semánticos |
| Documentación | 43 enlaces locales y 7 ejemplos JSON válidos |
| Arquitectura | Sin imports Spring/Jakarta en dominio ni aplicación |
| Git/secretos | diff --check correcto; Gitleaks sobre el diff publicable sin secretos detectados |

La primera ejecución completa detectó que H3 compartía la base H2 con suites que borran materias; H3 ahora usa `siare_h3` independiente, conservando las FKs y las pruebas anteriores. También se ajustó el script para eliminar variables de entorno opcionales en Windows y tratar sus valores vacíos como ausentes. La ejecución final incluye ambas correcciones.

El MySQL de prueba es independiente y volátil: demuestra comportamiento SQL real, restricciones, transacciones, carreras y lectura desde otro proceso, sin probar tolerancia a pérdida de disco o restauración de respaldos. MongoDB se sustituye mediante los puertos documentales existentes en las pruebas; se valida autorización/contrato documental y no se repite OCR real ni extracción Flask. La regresión OIDC usa proveedor controlado; no equivale a nuevas pruebas manuales con cuentas Google/GitLab. SMTP real sigue fuera de H3.

La recuperación del outbox se prueba con publicador de prueba; no acredita entrega a Express. Los eventos quedan PENDING en la implementación entregada porque el adaptador HTTP está pendiente. El productor respeta la propuesta de nombres/versiones del PR #4; el acuerdo del consumidor y sus garantías Cassandra/ClickHouse todavía requieren revisión del integrante de analítica.

## Docker y publicación

Al iniciar H3, Docker reportó `healthy` en mysql, mongo, redis, cassandra, clickhouse, core-api, content-ai, progress-api y frontend. La comprobación final ejecuta [Test-Siare.ps1](../scripts/Test-Siare.ps1), incluidas consultas reales a los motores y salud HTTP. La prueba temporal se retira y la composición conserva nueve servicios.

La composición en ejecución conserva sus imágenes anteriores: este trabajo prepara el código H3 y el PR para revisión; no despliega ni aplica V5 sobre los volúmenes existentes. Se deberá reconstruir y desplegar core-api mediante el procedimiento habitual después de revisar/integrar. El frontend permanece pendiente de catálogo, banco, vista Quiz/Crucigrama, envío y revisión de resultados, además de las rutas BFF con CSRF. No hubo cambios en frontend, mobile, services/content-ai, services/progress-api, secretos ni configuración de volúmenes.

La entrega se publica en `feature/core-actividades` con un Pull Request hacia main para revisión. El enlace y estado remoto se indican en la entrega; la integración permanece pendiente de revisión. No se fusiona automáticamente con main.
