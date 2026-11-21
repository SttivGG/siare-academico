# H6 — Integración y reversión

Actualización H6-7C: los procedimientos siguientes se preparan para una
autorización posterior. Esta tarea no despliega en 3100 ni modifica 3107.
Los nombres/etiquetas H6-7A son referencias históricas: primero hay que volver
a obtener el inventario efectivo, que actualmente no responde por Docker CLI.

## Configurar el origen público

`APP_ORIGIN` es configuración de confianza del operador, no un dato enviado por el navegador. Debe ser un origen completo sin ruta, usuario, contraseña, query ni fragmento. Puede terminar en `/`, que se normaliza. Ejemplos de configuración, no valores fijados en el código:

Usar la forma canónica del origen en ambos procesos: hostname en minúsculas y sin puerto predeterminado explícito (`:443` en HTTPS o `:80` en HTTP). En desarrollo configurar `APP_ORIGIN` también en el proceso de Next; no hay un fallback implícito a 3100. No cambiar `.env` ni los clientes federados del entorno habitual para preparar una preview.

| Entorno | Frontend `APP_ORIGIN` | Core OIDC y callbacks |
| --- | --- | --- |
| Habitual | `http://127.0.0.1:3100` | Mismo origen; callback `/api/oidc/callback/google` o `/gitlab` |
| Preview | `http://127.0.0.1:3107` | Core dedicado con ese origen y callbacks registrados para preview |
| Desarrollo | `http://localhost:<puerto>` | Origen exacto, incluido hostname y puerto |
| Producción | `https://<dominio-autorizado>` | Mismo dominio HTTPS y callbacks exactos autorizados |

El frontend de preview conserva su configuración existente. El core activo está preparado para 3100: no se cambia para probar 3107. Si comparte ese core, la preview rechaza el inicio federado incompatible; el acceso local continúa disponible. Para habilitar OIDC real en otro entorno, el responsable debe preparar un core y clientes registrados para ese origen. `GOOGLE_REDIRECT_URI` y `GITLAB_REDIRECT_URI`, si se especifican, deben coincidir con `APP_ORIGIN` del core. Configurar también el origen del correo (`siare.mail.origin`) antes de validar recuperación SMTP. No se alteran clientes ni credenciales de producción.

En HTTPS mantener `SESSION_COOKIE_SECURE=true` (predeterminado); `false` se admite exclusivamente en el entorno HTTP local ya existente. El proxy debe publicar el origen autorizado y preservar los controles de origen; la aplicación no utiliza cabeceras de host para construir destinos. No es necesario autorizar hosts arbitrarios ni ampliar CORS/CSRF.

## Validación reproducible sin bases habituales

Desde `frontend/`, con dependencias fijadas por el lockfile:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run typecheck
npm.cmd run test:integration:activities
npm.cmd run test:integration:identity
npm.cmd run test:integration:nexo
$env:E2E_BASE_URL='http://127.0.0.1:3137'
$env:ACADEMIC_EVIDENCE_DIR='../.cache/h6-release/academic'
$env:LANDING_EVIDENCE_DIR='../.cache/h6-release/landing'
$env:APPEARANCE_EVIDENCE_DIR='../.cache/h6-release/appearance'
$env:SORVO_EVIDENCE_DIR='../.cache/h6-release/sorvo'
$env:NEXO_EVIDENCE_DIR='../.cache/h6-release/nexo'
npm.cmd run test:e2e:release
```

La configuración release levanta Next compilado en loopback 3137 y un upstream HTTP aleatorio en memoria. No existe fallback al core real. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permite seleccionar Chromium instalado. La configuración copia automáticamente los tres PDF sintéticos rastreados de `frontend/tests/fixtures/documents/` a `.cache/phase2-fixtures/`. Rechaza `SIARE_TEST_PDF` para impedir el uso accidental de documentos personales. La fixture modela contratos para probar el cliente: no sustituye pruebas de extracción, evaluación, autorización, TOTP ni persistencia de Spring.

## Procedimiento de preview, pendiente de autorización posterior

Identificar por etiquetas Compose el contenedor que publica 3107: proyecto `siare-h6-3-validation`, servicio `frontend-h6`. Guardar ID de imagen anterior, archivos Compose efectivos, etiquetas, puertos, redes y mounts. Etiquetar la imagen anterior como `siare-academico-frontend:h6-7a-rollback`. Construir con `frontend/Dockerfile`, etiquetar con el commit probado y comprobar la revisión de la imagen.

Usar los controles oficiales `Assert-SiareDocker`, `Assert-SiareOwnership`, `Assert-SiareExclusiveVolumes` y `Test-SiareComposeFiles` de `scripts/Common.ps1` en el workspace habitual. Resolver los archivos Compose desde las etiquetas del contenedor; añadir un override que cambie únicamente imagen y etiquetas. Comparar el resto de la configuración antes/después. Recrear únicamente:

```text
docker compose <proyecto y archivos efectivos de preview> up -d --no-deps --no-build --pull never --wait --wait-timeout 120 frontend-h6
```

Esperar `healthy`, comprobar `/api/health` y navegar en 3107. Verificar que los nueve contenedores habituales conservan IDs, imágenes, arranque, mounts y redes; comprobar salud y navegador en 3100. No ejecutar `down`, limpieza global, eliminación de volúmenes ni recreación de dependencias.

## Reversión de preview

Usar los mismos archivos/proyecto efectivos con un override final que seleccione `siare-academico-frontend:h6-7a-rollback` y las etiquetas anteriores. Ejecutar la misma operación selectiva `up ... frontend-h6`, esperar `healthy` y repetir las comprobaciones de ambos puertos. La reversión no modifica datos ni configura otro core. El plan local conserva los archivos y etiquetas exactos en `.cache/h6-release/preview-before.json` y el script `rollback.ps1`.

## Paso posterior, no autorizado todavía

Después de aprobar este candidato, revisar nuevamente `origin/main`, HEAD del PR, diff, pruebas y restricciones externas. Solo una autorización posterior y explícita permite fusionar a main o actualizar 3100. Conservar las ramas/PR originales, imagen funcional y volúmenes. No aplicar Flyway V6 ni activar ML. Si main cambia, volver a validar el resultado de integración sin reescribir su historial.

Para 3100, obtener de las etiquetas del frontend habitual el proyecto Compose y
sus archivos efectivos; no inferirlos del nombre de una imagen. Usar los controles
de `scripts/Common.ps1` citados arriba, registrar revisión, imagen activa y sus
etiquetas, puertos, mounts, redes e IDs de los nueve servicios. Conservar esa imagen
con una etiqueta de reversión única antes de construir desde el commit aprobado.
Comparar la configuración resuelta sin imprimir secretos y permitir solo el cambio
de imagen/revisión del servicio frontend. No copiar un `.env` de otro worktree.

Después de la autorización, ejecutar el equivalente selectivo con el proyecto y
archivos efectivos, `up -d --no-deps --no-build --pull never --wait
--wait-timeout 120 frontend`. No recrear bases ni aplicar migraciones. Verificar
`healthy`, `/api/health`, navegación pública por navegador y que los demás ocho
servicios, datos, redes, mounts y credenciales permanezcan iguales. Las pruebas
autenticadas continúan en el entorno de memoria, salvo un alcance autorizado nuevo.

Si falla, seleccionar la imagen anterior y las etiquetas registradas mediante un
override limitado al frontend, ejecutar la misma recreación selectiva y repetir
salud/navegador/preservación. No borrar volúmenes ni usar `down` o prune. Registrar
el resultado real; una imagen construida sin contenedor healthy no acredita un
despliegue. El merge y el despliegue son autorizaciones separadas.
