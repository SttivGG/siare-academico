# Consolidación de main — 18/11/2026

Nota posterior al cierre: la consolidación terminó con PR #1, #2 y #3 fusionados y `main` en `035d74e1e953573c24b9f1371cf604ce62b1a98b`. La preparación del [equipo de cuatro integrantes](EQUIPO_ROLES.md) parte de esa base y solo añade documentación mediante otro PR; no repite merges ni pruebas de consolidación. El usuario reportó después validación manual exitosa de GitLab OIDC; su alcance está en [GitLab real](H2B2_GITLAB_REAL.md). Los resultados y el estado de proveedores descritos abajo corresponden al corte anterior a esa confirmación y se conservan como evidencia histórica.

Fecha de ejecución: 18 de noviembre de 2026, America/Bogota. H1, H2-A, H2-B1 y H2-B2 están integrados en [main](https://github.com/SttivGG/siare-academico/tree/main). Las pruebas indicadas terminaron sin fallos críticos. Este documento distingue las verificaciones de esta revisión de las evidencias históricas del 11 de noviembre. La preparación móvil es documental: no se implementó React Native ni se declara entregado OIDC nativo.

## Historia y preservación

Estado inicial: `main` y `origin/main` en `a8bb7c221a526509b0cc8b513dffccba975ac7cb`; PR [#1](https://github.com/SttivGG/siare-academico/pull/1) abierto desde `feature/adecuacion-instructivo` en `56fb9968b7aeff3c5e4df511c2bb6f49e02eb571`. H2-B2 tenía cambios sin commit.

| Commit previo | Contenido |
| --- | --- |
| `a8bb7c221a526509b0cc8b513dffccba975ac7cb` | Fase 1, registro/login y materias |
| `2d7aa04d739f8f65245d25f2201ec033382b1bbe` | Fase 2, documentos |
| `56fb9968b7aeff3c5e4df511c2bb6f49e02eb571` | H1, Compose separado y ClickHouse |
| `d21e1241a12a4a21edfd905a37bdcf2b96ba6a54` | H2-A y H2-B1 juntos: roles, ámbitos, sesiones, MFA y recuperación |

La rama `feature/h2a-roles-sesiones` apuntaba todavía a H1; el reflog no contiene un commit H2-A independiente. Sus funciones están incluidas en `d21e124`, que se conserva para no dividir artificialmente trabajo ya comprometido. H1 es ancestro de H2; no se aplican cambios duplicados mediante cherry-pick.

Respaldo local: `backup/pre-consolidacion-20261118` conserva el HEAD inicial y `.local/consolidation/20261118-125546/` conserva copias de archivos pendientes y parches de trabajo/índice. Estos respaldos permanecen ignorados y no se publican. No se descarta trabajo ni se borran ramas, datos, volúmenes o claves.

## Integración mediante pull requests

| PR | Resultado |
| --- | --- |
| [#1: documentos y H1](https://github.com/SttivGG/siare-academico/pull/1) | Merge commit `95d881fa52fa9baa5902ffe58ed91ac0c7d674a6`; conserva `2d7aa04` y `56fb996` |
| [#2: H2 completo](https://github.com/SttivGG/siare-academico/pull/2) | Merge commit `dcbe2865b6556fdf1d59a41d13f354ea8b324b77`; conserva `d21e124` y añade `050064f59e9e94e9df4b4985a333cac860305af5` (`feat(oidc): integrate Google and GitLab`) |

El merge simulado de H2 y el árbol remoto después de fusionarlo coinciden exactamente con el árbol probado `050064f`. No hubo conflictos ni cambios funcionales adicionales al integrar. Las guías y este informe se entregan en un PR documental posterior, con una nueva rama y merge commit. El hash final de main se obtiene después de esa fusión con `git rev-parse HEAD` y se comunica en el reporte de cierre; no se fija dentro del mismo commit que lo modifica.

GitHub admite merge commits y tiene desactivado el borrado automático de ramas. Al revisar no había protección de main, reglas activas, revisiones bloqueantes ni checks obligatorios; no se cambió esa configuración. No hay un workflow CI versionado para estas pruebas, por lo que los resultados son de ejecución local y Docker, no de GitHub Actions. El conector permitió lectura pero rechazó escritura con 403; se usó la sesión autorizada de GitHub CLI. No se usó force push, squash, rebase ni tag de entrega.

## Verificaciones ejecutadas

| Verificación | Resultado actual |
| --- | --- |
| Java 21, Maven offline `verify` | 135 pruebas, cero fallos/errores/omisiones; JAR compilado |
| Next.js | 19 unitarias, build y TypeScript correctos |
| BFF OIDC compilado | 6 pruebas HTTP, upstream controlado de loopback |
| Express | 3 pruebas y compilación TypeScript correctas |
| Flask en Windows | 13 descubiertas, 12 correctas y una omitida de OCR real |
| Flask en Docker | 13 correctas, incluido OCR real con Tesseract español; sin omisiones |
| HTTP Fase 1 | 31 comprobaciones correctas |
| HTTP H2-A | 43 comprobaciones correctas |
| HTTP H2-B1 | 34 comprobaciones correctas, incluida persistencia MFA tras reiniciar |
| OIDC con MySQL/Redis reales | Dos pruebas correctas, Google/GitLab controlados; sin omisiones |
| HTTP H2-B2 | 23 comprobaciones correctas tras reiniciar MySQL/Spring/Next; refresh, revocación y callbacks |
| HTTP Fase 2 | 175 comprobaciones correctas; GridFS, extracción real, caída/recuperación Flask y persistencia después de reiniciar |
| Navegador | 18 recorridos correctos en escritorio/móvil: registro/login, sesiones, MFA, OIDC controlado, materias y documentos |
| Docker | Nueve contenedores existentes arrancados; todos saludables |
| Persistencia antes/después de construir Spring y Next | Coinciden MySQL, Mongo/GridFS, claves RSA y montajes |
| Imágenes Spring y Next | Construcción correcta, pasos reutilizados desde caché Docker |
| Secretos, historial inicial | Gitleaks 8.30.1: cuatro commits, sin hallazgos |
| Secretos, árbol publicable y staged H2-B2 | Gitleaks 8.30.1 sin hallazgos; se excluyen archivos locales ignorados |
| Secretos, historial y árbol publicable | Escaneo adicional de 710 contenidos, nueve secretos locales comparados privadamente, sin coincidencias |
| OpenAPI | 42 rutas, 47 operaciones coincidentes con controladores, 403 referencias resueltas |

La comparación de continuidad posterior conserva las 214 filas de usuarios y materias de su baseline, además de RSA, AES, `.env` y montajes. Las pruebas posteriores crean sus propias cuentas/documentos sintéticos y conservan esos datos. La comprobación anterior a las regresiones también confirmó igualdad de MySQL y Mongo/GridFS antes/después de construir las aplicaciones. No se realizó limpieza de bases ni volúmenes.

Logs privados ignorados: `.cache/consolidation-*`. El informe no reproduce credenciales ni archivos privados. El análisis de secretos combina reglas automáticas, comparación con valores locales y revisión de archivos; no acredita una auditoría exhaustiva de seguridad.

Gitleaks 8.30.1 se obtuvo de su release oficial y se comprobó el SHA-256 contra el archivo de checksums publicado. El análisis previo a publicar H2 cubrió los cinco commits alcanzables, incluidos los cuatro posteriores al main inicial. No se encontraron secretos que exigieran reescribir historia. `.env.example` mantiene contraseñas/client secrets/tokens vacíos; `.env`, `.cache`, `.local`, claves privadas y respaldos permanecen fuera de Git. Antes de confirmar la documentación se repite la revisión staged, referencias OpenAPI y enlaces locales; el cierre vuelve a comprobar el historial completo.

Comandos de validación utilizados: Maven Java 21 offline `verify`; en frontend `npm test`, `npm run build`, `npm run typecheck`, `node --test tests/integration/oidc-bff.mjs`, `npm run test:e2e`; en Express `npm test`; Flask unittest en host y contenedor (`SIARE_REAL_OCR=1`); `Test-Siare.ps1`, `Test-Phase1.ps1`, `Test-H2A.ps1`, `Test-H2B1.ps1 -RestartContainers`, `Test-H2B2.ps1 -RestartContainers` y `Test-Phase2.ps1 -SimulatePythonOutage -RestartContainers`.

## Estado de servicios y contrato móvil

MySQL, MongoDB, Cassandra, Redis, ClickHouse, Spring `core-api`, Flask `content-ai`, Express `progress-api` y Next `frontend`: los nueve saludables después de las suites. También pasaron consultas autenticadas a los cinco motores y la comunicación frontend → Spring, Flask → Mongo/Redis y Express → Cassandra/ClickHouse. Solo están publicados 3100 y 8180 en loopback; no se abren bases de datos.

Rutas directas disponibles, bajo `/api/v1`: registro/login en `/auth/register` y `/auth/login`; refresh en `/auth/refresh`; logout en `/auth/logout`; sesiones en `/users/me/sessions`; desafíos MFA en `/auth/mfa/*`; identidad/roles en `/users/me/identity`; materias en `/subjects`; carga/lista en `/subjects/{subjectId}/documents`; consulta, descarga, procesamiento y texto en `/documents/{documentId}` y sus subrutas. El [contrato móvil](CONTRATO_API_MOBILE.md) detalla métodos, JSON, HTTP y límites; [OpenAPI](openapi.json) coincide con los controladores. No existe DELETE físico de materias: se archivan.

## Proveedores y trabajo móvil pendiente

Google login/alta: confirmación histórica del usuario del 11/11/2026; no repetida con cuentas reales en esta consolidación. GitLab: configuración e inicio de flujo documentados, sin confirmación del canje/login/alta/vinculación/MFA reales. SMTP: entrega real pendiente. Los proveedores controlados de pruebas no sustituyen estas comprobaciones externas.

El cliente nativo puede diseñarse sobre login local, refresh, revocación, MFA, roles, materias y documentos. Faltan el contrato OIDC nativo, callback/canje para la aplicación y un entorno HTTPS confiable accesible desde Android. No se implementa React Native ni se crean commits a nombre del compañero. Véanse [onboarding](ONBOARDING_MOBILE.md), [contrato](CONTRATO_API_MOBILE.md) y [colaboración](GUIA_COLABORACION.md).
