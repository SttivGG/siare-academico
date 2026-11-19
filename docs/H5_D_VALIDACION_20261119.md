# Verificación H5-D, 19/11/2026

Zona: America/Bogota. Rama `feature/h5-d-persistencia-borradores`, worktree
`.worktrees/h5-d`. Implementación: `9eab50a6333e70b9f16615aeeb91372dd98d0e6a`.
Base H5-B: `ca27a80bf3d398286016ec871fa7cdc4fc64403f`; main comprobado:
`c8f934492f0cc7809282657270df34b4474915ca`. PR #8 seguía abierto como draft,
dirigido a main. H5-D se entrega como PR independiente hacia
`feat/h5-b-generation-port`; no se fusiona ninguno.

## Resultados ejecutados

| Verificación | Resultado |
| --- | --- |
| Maven offline `verify`, Temurin 21.0.13+9, Maven 3.10.0 | 249 pruebas, cero fallos/errores, dos omisiones previstas |
| Suite H5 v1 Python offline | 24 pruebas pasadas |
| MySQL 8.4.13: V5 con datos previos | Una prueba pasada; usuario, materia y sesión sintéticos persistidos |
| MySQL: migración V6 | Una prueba pasada; V1–V5 válidas y datos previos conservados |
| MySQL: restauración nativa del respaldo V5 | Una prueba pasada; sin V6 y con usuario, materia y sesión previos |
| MySQL: ciclo de vida H5-D y MockMvc con seguridad real | 18 pruebas, cero fallos/errores/omisiones |
| Segunda JVM Spring tras reiniciar el mismo MySQL | Una prueba pasada; borrador, huella, expiración y publicación idempotente recuperados |
| Controles oficiales `Test-Siare.ps1`, inicial/final | Nueve healthy, cinco motores consultados, backends y frontend hacia Spring correctos |
| Preservación habitual | Contenedores, imágenes, inicio, montajes, redes y datos comparados sin diferencias |
| OpenAPI | 48 rutas, 55 operaciones y 513 referencias locales resueltas |
| Arquitectura | Sin imports Spring/Jakarta en dominio/aplicación |
| Git y secretos | `diff --check` correcto; Gitleaks del diff publicable sin hallazgos |

La prueba optativa del PDF original también pasó; el archivo sigue fuera de Git.
Las dos omisiones del verify son `DocumentBrowserIntegrationTests`, que requiere
un despliegue desechable con navegador, y el test que escribe evidencia para el
reinicio MySQL, habilitado en la ejecución real. Las suites con tag `real-stores`
se mantienen bajo selección explícita; se ejecutó `AcademicDraftRestartTests`.
No se repitieron OIDC contra proveedores reales, SMTP ni pruebas visuales, dado
que esta fase no modifica esos componentes ni la interfaz.

## Evidencia de comportamiento

`AcademicDraftLifecycleTests` usa MySQL/JPA/JDBC, JWT/sesiones y filtros Spring
reales. El generador y el puerto documental se sustituyen por fixtures sintéticas
de test. No existe un endpoint administrativo para cargarlas.

Seis publicaciones concurrentes con la misma clave devolvieron un activityId:
una creación y cinco recuperaciones, con una única fila H3. Dos ediciones
simultáneas con revisión 1 produjeron una revisión 2 y un conflicto optimista.
Los reintentos MockMvc simulan perder la primera respuesta: reciben el mismo
cuerpo H3 y Location. No se afirma haber cortado una conexión TCP real.

Se probó publicación de Quiz y Crucigrama, seguida de evaluación H3 con score 1.
Un fallo inducido después del insert H3 revirtió actividad y publicación; la clave
quedó reutilizable. Un cambio documental después del insert también revirtió H3.
El generador H3 real rechazó un crucigrama sin intersecciones con
`INVALID_CROSSWORD`, conservando el borrador pendiente.

Se verificaron edición de preguntas y pistas/explicaciones, revisión vieja,
invalidación de atribución ML por revisión, expiración exacta a 24 horas con reloj
controlado, propietario ajeno, identidad deshabilitada, confirmación ausente,
materia archivada, documento no READY, cambio de operationId, cambio de texto
con el mismo operationId y reasignación del documento. Citas inventadas,
referencias incorrectas, respuestas inválidas y `validated:true` fueron rechazados.

Los tests públicos rechazan claves JSON duplicadas, campos omitidos, autoridad
inyectada, coerción de tipos y cuerpos excesivos. Las respuestas H3 no contienen
claves, soluciones, explicaciones ni citas. La captura de logs comprobó ausencia
de explicación privada, cita, Bearer y credencial rechazada; las rutas privadas
conservan no-store en éxito y error.

## MySQL aislado y respaldo

Ejecución final: `987f71a7ec274ec687d0be766e49bd85`.
Contenedor `siare-h5d-test-987f71a7ec274ec687d0be766e49bd85`, volumen persistente
`siare-h5d-test-data-987f71a7ec274ec687d0be766e49bd85`, puerto loopback 13326.
Imagen: `mysql:8.4.13@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902`.

Las bases exclusivas fueron `siare_h5d_test` y `siare_h5d_migration_test`.
El dump `mysqldump --single-transaction --add-drop-database` se obtuvo con V5 y
se restauró únicamente sobre el esquema desechable de migraciones. La base del
ciclo de vida conservó sus datos durante el reinicio. El contenedor terminó
detenido y quedó conservado con el volumen y el dump. La ejecución preliminar
`64651c5fa8e0498daf078b9f2b815983` también quedó detenida y conservada.

Logs, `pre-v6.sql`, `restart.json`, `mounts.json` y `run.json` están en
`.worktrees/h5-d/.cache/h5d/987f71a7ec274ec687d0be766e49bd85/`.
Los logs finales de verify, contrato y salud están en `.cache/h5d-verify-final.log`,
`.cache/h5d-contract.log` y `.cache/h5d-health-final.log` de la raíz original.
Los artefactos locales están ignorados y contienen solo pruebas sintéticas o
huellas de preservación; no se publican respaldos ni datos de usuarios.

## Compatibilidad y límites

H5-B conserva su puerto, DTO, contrato HTTP y adaptador deshabilitado. El nuevo
caso de uso persistente reutiliza el snapshot y los validadores existentes.
La prueba de contrato Python cambió solo su expectativa sobre las tres rutas
Spring ahora implementadas. Los archivos normativos H5 v1 no cambiaron.

H3 mantiene Abstract Factory, generación, evaluación, proyección pública e
intentos/outbox. Se normalizó únicamente la fecha de creación a microsegundos,
para igualar primera respuesta y lectura MySQL. Su prueba histórica de migración
ahora fija target 5 para continuar verificando exactamente V4 a V5; H5-D verifica
V5 a V6 por separado. El verify completo incluyó sus regresiones.

Las comprobaciones documentales antes y después de H3 detectan los cambios
observados y revierten MySQL. No acreditan atomicidad distribuida ni eliminan
la ventana entre la última lectura Mongo y el commit. El tratamiento se explica
en [ciclo de vida](H5_D_BORRADORES.md). El productor ML, su validación semántica y
la conexión HTTP real permanecen pendientes; las fixtures no los sustituyen.

## Instalación habitual conservada

Proyecto Compose `siare-academico`, archivos activos `compose.datos.yml`,
`compose.apps.yml` y `.local/deployment-h4-20261119/frontend-source.json`.
No se reconstruyó ni recreó ningún servicio y no se aplicó V6. La imagen funcional
core-api sigue disponible para reversión:
`sha256:ecff70dea3a1061462ec103d81fed5f6729a2b8cee1113670afc87f814642e84`.

| Servicio | Contenedor | Imagen activa (SHA-256 abreviado) | Estado final |
| --- | --- | --- | --- |
| frontend | eae9ae80e3c1 | c67d08bd4d4e | healthy |
| core-api | 27138d454210 | ecff70dea3a1 | healthy |
| content-ai | 8a7f97dc46a9 | 212a8df4b689 | healthy |
| progress-api | c5ee706867eb | cb222edc168b | healthy |
| mysql | a874a4f0ab46 | a81d043930e5 | healthy |
| cassandra | 274b64b24986 | 4d020740a849 | healthy |
| redis | d7b516acd286 | 7b1753b4c5ad | healthy |
| clickhouse | f93db5993ddb | d426d2f612e1 | healthy |
| mongo | c11e8984ca8b | b9924c330a8b | healthy |

Los resúmenes inicial/final en `.local/h5d/` coincidieron: 243 usuarios,
125 materias, checksums de usuarios/materias/accesos/sesiones/refresh tokens,
historial Flyway V1–V5, huella de `.env`, claves RSA y montajes. Mongo conservó
199 metadatos, 322 fragmentos, 199 archivos GridFS y 213 chunks, con las mismas
huellas de cada colección. Las claves MFA y credenciales no se escribieron.
La página `http://127.0.0.1:3100/` respondió 200 y su API de salud confirmó Spring.

Los cambios previos del checkout original, su rama y los demás worktrees se
conservaron. Esta entrega no incluye frontend/BFF, Python, Express ni cambios
de redes, volúmenes o secretos. Los siguientes pasos ML y el procedimiento de
despliegue autorizado están en [H5_D_BORRADORES.md](H5_D_BORRADORES.md).
