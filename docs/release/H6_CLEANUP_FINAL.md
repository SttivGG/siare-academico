# H6-7C: informe final de limpieza

Fecha: 21/11/2026, America/Bogota. Rama: `release/h6-sorvo-main-final`.
Base: `c8f934492f0cc7809282657270df34b4474915ca`. Fuente H6:
`597d045f8bcdbc14a2e68f4d7d8cdc435267c98f`.

Recomendación: **MERGE NO-GO** hasta completar las comprobaciones actuales de
runtime descritas en el [checklist](H6_RELEASE_CHECKLIST.md). El nuevo draft
permite revisar una entrega ligera sin fusionar, cerrar PR originales o
desplegar sobre 3100. Se preservan las ramas e imágenes existentes; no se
ejecuta ninguna mutación Docker.

## Alcance y método

Se inspeccionan las rutas de main y H6: raíz, frontend, servicios, scripts,
Docker, configuraciones, recursos, tests, fixtures, contratos y documentos.
El [inventario CSV](H6_FILE_AUDIT.csv) registra cada archivo canónico de la unión
main/H6 y grupos de archivos locales de todos los worktrees registrados.
SHA-256 corresponde a los bytes canónicos del objeto Git indicado. En filas
`@local/`, corresponde al manifiesto ordenado de rutas, tamaños y hashes físicos;
no debe compararse con el hash de un archivo individual.

`scripts/release/audit-h6.py` reproduce la extracción desde las dos revisiones
fijadas. Los archivos físicos ignorados/no rastreados se inventarían en
`.cache/h6-final/physical-files.csv` del workspace, que permanece privado.
El inventario no abre bases, contenedores, volúmenes ni almacenes de claves
externos al repositorio. Tampoco sigue junctions o symlinks fuera del árbol.
Los artefactos de esta auditoría se generan después del corte inventariado;
el diff del candidato y sus hashes de publicación completan su trazabilidad.

Las referencias combinan rutas/nombres, imports y convención del framework.
Una referencia textual ausente se marca como revisión, nunca como prueba de
que se pueda borrar código. El [grafo frontend](H6_FRONTEND_REVIEW.json)
complementa el inventario con AST, entradas App Router y recursos.

## Clasificación y exclusiones

| Categoría | Tratamiento |
| --- | --- |
| A, esenciales | Conservar fuentes, configuración, contratos ejecutables, migraciones existentes, pruebas y fixtures |
| B, documentación vigente | Conservar instalación, arquitectura, equipo, contratos, licencias y notas breves de H6 |
| C, evidencia histórica | Excluir las adiciones H6 del candidato; conservar commit original e índice con hashes |
| D, material obsoleto/redundante | Documentar propuestas verificadas o pendientes de confirmar; no borrar main ni alterar el frontend aprobado |
| E, privado/generado | Conservar local y fuera del PR; proteger mediante ignore y no publicar contenidos |

Se excluyen del candidato 2170 archivos H6, 687.630 MiB, sin borrar originales.
Incluyen galerías de `h6-sorvo`, `h6-4`, `h6-3`, `h6-2`, fases de landing,
prototipo H6-1 e informes y resultados intermedios. Cada ruta conserva tamaño,
SHA-256, objeto Git, motivo y enlace fijado a commit en el
[archivo histórico](H6_HISTORICAL_ARCHIVE.csv).

No se transfiere evidencia a un archivo externo. El commit histórico sigue en
el mismo repositorio y no constituye un respaldo externo. El ahorro corresponde
al contenido del nuevo candidato y su diff; el remoto conserva los blobs
históricos y las ramas originales. No se reescriben los 53 commits de H6.

Se conservan las capturas H4, todos los documentos de main y las áreas del equipo.
La [revisión funcional](H6_FUNCTIONAL_DUPLICATES.md) distingue las propuestas
sobre main de las exclusiones autorizadas para H6.
La [lista de propuestas](H6_CLEANUP_PROPOSALS.csv) identifica por separado
los candidatos D y los documentos de main que requieren revisión de sus responsables.

## Duplicados y frontend

Se encontraron 111 grupos exactos que afectan 250 rutas, detallados en
[duplicados exactos](H6_EXACT_DUPLICATES.csv). Las copias de ejemplos H3 y
fixtures, archivos vacíos de paquetes y licencias necesarias permanecen.
Se excluyen copias históricas de fuente/licencia del prototipo, conservando
los recursos públicos consumidos. La similitud visual no se usa para borrar
fotografías, miniaturas o logos de bytes diferentes.

Se calcularon también huellas visuales dHash de 1936 imágenes: 1270 parejas
orientativas con SHA-256 distinto, documentadas en
[similitud visual](H6_VISUAL_SIMILARITY.csv). No se interpretan como identidad
ni se retiran automáticamente recursos por su parecido.

El árbol frontend inicial es `d7c0ff7905bbacb98c82664ca0568bb5afafc8e0` y
permanece idéntico al cerrar. No se retiraron imports, componentes, CSS, tests,
scripts de medición ni el logo anterior para reducir el peso artificialmente.
Los diez diagnósticos de imports/variables sin uso y candidatos de CSS se
documentan para un cambio separado con sus propias regresiones.

Landing usa `siare-logo-clean.png`. Los cinco fondos, sus miniaturas y Sin imagen
mantienen su lista cerrada y carga selectiva. Urbanist y OFL se conservan.
La procedencia y los créditos están en
[recursos de Apariencia](../design/H6_APARIENCIA_RECURSOS.md).
Los recursos usados, sus tamaños y consumidores están en la revisión frontend.

## Pruebas, documentos y privacidad

Se conserva todo el código de pruebas H6: 50 unitarias/componentes, 17 casos de
integración controlada y los 130 casos/proyectos de Playwright, con cinco
omisiones ya existentes. No se retiran pruebas ni se añaden skips. Las tres
fixtures PDF versionadas son necesarias para la suite documental y se conservan
con su generador reproducible de `services/content-ai/tests/fixture_factory.py`.
Logs, capturas, videos, traces, JSON de resultados y cobertura pertenecen a
salidas locales o históricas, separadas del código de pruebas.

El [índice documental](../INDEX.md) identifica cada documento de main y H6,
su vigencia, propósito y autoridad. Las guías técnicas históricas no sustituyen
contratos actuales. Los enlaces a documentos/evidencias excluidos se fijan al
commit H6 original. No se corrigen archivos documentales ajenos sin autorización.

Se detectan `.env`, estado `.local`, caches, dependencias, builds y resultados
locales como material E. Sus contenidos no se copian ni publican. El ignore
existente protege entorno, PEM/KEY, dependencias y builds; se añaden worktrees,
cobertura anidada, reportes Playwright y almacenes de firma locales. No se ignoran
migraciones SQL, fixtures PDF ni recursos públicos. Los PDF se mantienen binarios
y los CSV de release usan LF en `.gitattributes`.

El escaneo preliminar del directorio, incluidos builds locales, señaló trece
claves efímeras de preview/caché/cifrado de Next bajo `.next/`; no son credenciales
operativas del proyecto y no se incorporan. El escaneo del conjunto publicable
aprobó con Gitleaks 8.30.1, exit 0 y cero hallazgos; se repite sobre el árbol final
antes de publicarlo. No se imprimen secretos de entorno, cookies,
frases locales, semillas MFA, JWT ni documentos privados.

## Equivalencia y pruebas de esta preparación

TypeScript, build, 50 unitarias, actividades 4/4, identidad/OIDC 8/8 y estados
internos 5/5 aprobaron sobre el candidato. Playwright vuelve a recorrer
ST-01 a ST-10, Apariencia, autenticación, origen/puertos/OIDC, documentos,
Quiz y Crucigramas: Playwright final aprobó 125 casos, cero fallos/flaky y cinco
omisiones preexistentes en 8,7 minutos. El [resumen](H6_VALIDATION_SUMMARY.json)
conserva estadísticas y hashes de los logs. La matriz de 58 filas conserva sus identificadores y
escenarios; el build confirma las 15 rutas y cinco handlers.

Todas las pruebas autenticadas usan datos sintéticos en memoria. No se
escriben datos de prueba en bases habituales. Estas pruebas no acreditan
servicios externos ni seguridad, autorización o persistencia reales de Spring.
Los límites de OIDC/SMTP y validación manual permanecen explícitos.

## Docker y decisión

Durante esta preparación `docker version` y `docker ps` agotaron 15 segundos
cada uno, incluso con acceso fuera del sandbox. HTTP 3100 agotó cinco segundos;
3107 rechazó conexión. No se atribuye la causa a H6 ni se asegura que la
instalación previa continúe healthy. Los IDs e imágenes del informe H6-7A
son referencias históricas, no un inventario actual.

No se ejecutan `build`, `up`, `down`, restart, prune, migraciones, Flyway V6,
generación ML, cambios de redes ni volúmenes Docker. Se preservan `.env`, claves,
credenciales y archivos Compose. La solicitud prohíbe desplegar en 3100 y
pide conservar 3107; prevalece sobre el despliegue habitual de AGENTS.md.

Antes de recomendar MERGE GO, resolver la disponibilidad del entorno bajo
responsabilidad del operador, volver a identificar proyecto/imágenes activos,
confirmar salud y comportamiento con navegador y conservar una imagen de
reversión verificable. Cualquier despliegue sobre 3100 requiere autorización
posterior. El [procedimiento](H6_INTEGRATION_PLAN.md) conserva los controles
oficiales y operaciones selectivas para ese momento.

## Cierre cuantitativo

Se analizaron 2673 rutas canónicas (main: 420; H6: 2673) y 178435 archivos físicos en 14 worktrees, 13,155,042,481 bytes sumando las copias locales. El complemento privado incluyó doce archivos protegidos; siete rutas largas de caché se recuperaron con rutas extendidas de Windows. No quedaron errores de lectura. Los directorios Git administrativos y enlaces externos no se tratan como fuentes del proyecto.

| Medida | H6 original | Candidato ligero |
| --- | --- | --- |
| Archivos del árbol | 2673 | 518 |
| Contenido completo, MiB | 693.403 | 8.888 |
| Bytes de archivos añadidos frente a main, MiB | 690.331 | 5.816 |

Reducción de contenido añadido: 99.16%. Se excluyen 2170 rutas históricas, 687.630 MiB. No hay eliminaciones de archivos preexistentes de main ni cambios en servicios/Compose/migraciones; las únicas configuraciones raíz modificadas son ignore y atributos, dentro de la solicitud.

El [manifiesto final](H6_CANDIDATE_MANIFEST.csv) clasifica y calcula SHA-256 del candidato actual, incluidos los informes nuevos, y complementa el inventario canónico de las revisiones fuente. Su propia fila se omite para evitar autorreferencia; el commit de publicación identifica también ese CSV. El [resumen de auditoría](H6_AUDIT_SUMMARY.json) conserva las cifras en formato estructurado. Los bytes completos se comparan sobre contenido canónico Git, sin compresión ni deduplicación; no son el tamaño de transferencia ni del remoto.

TypeScript/build, 50 unitarias, 17 integraciones y Playwright 125 PASS/5 omisiones preexistentes aprobaron. Gitleaks del conjunto publicable terminó en exit 0; el hash de `.env` habitual permanece igual al inicio del barrido. El frontend conserva el árbol aprobado y no se quitaron pruebas.

MERGE NO-GO se mantiene por la falta de salud e inventario actuales del runtime. La entrega es un draft revisable; no acredita despliegue efectivo. Los PR originales, ramas y evidencias permanecen abiertos/conservados; no se ha autorizado merge ni actualización de 3100.
