# Implementación de progreso y analítica

**Responsable:** Maicol Castillo  
**Rama:** `feature/progress-analytics`  
**Código de referencia:** `9611531`, con los cinco bloques implementados.  
**Revisión:** [PR #16](https://github.com/SttivGG/siare-academico/pull/16).

Spring evalúa la actividad y controla el acceso del estudiante a la materia.
Express acepta el evento interno, conserva el intento y el progreso en
Cassandra, entrega el evento a ClickHouse y usa Redis para acelerar las
consultas. La red interna de Docker conecta los servicios.

## Contrato implementado

El [OpenAPI interno v1](../services/progress-api/openapi.internal.json) documenta
las rutas, cabeceras, formatos, errores y ejemplos sintéticos de Express. El
[OpenAPI de Spring](openapi.json) sigue siendo la referencia de la API pública.

| Método y ruta de Express | Resultado |
| --- | --- |
| `GET /health` | `200 UP` o `503 DOWN` según la conectividad con Cassandra. |
| `POST /internal/v1/attempts` | `201` para nuevo intento, `200` para reenvío idéntico y `409` para conflicto. |
| `GET /internal/v1/students/{studentId}/progress` | Página de conteo, mejor nota, última nota y fecha por actividad. |
| `GET /internal/v1/students/{studentId}/indicators` | Conteo deduplicado, promedio, duración total y frescura de ingesta en un intervalo UTC. |
| `GET /internal/v1/cache/metrics` | TTL, estado de Redis y métricas de la instancia de Express. |

Salvo salud, las rutas requieren `Authorization: Bearer <credencial de servicio>`
y `X-Request-Id` canónico. El POST también exige `Idempotency-Key` igual a
`eventId`. Spring conserva los mismos IDs y datos al reintentar. Si el resultado
de la escritura es ambiguo y se reenvía el evento, Express puede completar el
progreso pendiente y devolver la fecha original. Un `503` indica que la operación
no se pudo confirmar o que la fuente requerida está indisponible.

Los intentos se registran por `attemptId`; una reserva duradera protege
`eventId`. La proyección por actividad usa un lote condicional para actualizar el
resumen y la marca de conteo juntos. ClickHouse recibe un lote después de
persistir el intento, y el proceso registra la entrega en Cassandra únicamente
después de la aceptación y la invalidación analítica. Si se repite la inserción,
la consulta agrupa por `event_id` antes de agregar. Redis usa un TTL de 60
segundos y generaciones conservadas en Cassandra. Al perder Redis, Express
consulta las fuentes para mantener disponibles las lecturas.

## Preparar y desplegar en Windows

Abre una terminal PowerShell en la raíz de `siare-academico`. Antes de aplicar
esquemas, inicia Docker Desktop y prepara la instancia SIARE con el
[procedimiento oficial de arranque](../README.md#arrancar-desde-powershell).
Si ya existe una instancia local, usa su `.env`, sus claves y sus volúmenes.

La configuración de Express para esta instalación usa dos overrides ignorados
por Git. Para reproducirlos cuando aún no existen, ejecuta el siguiente bloque
con Node.js 24 disponible. Los archivos existentes se conservan.

```powershell
New-Item -ItemType Directory -Force .cache | Out-Null

if (!(Test-Path .cache/progress-local.env)) {
    $progressToken = node -p "require('node:crypto').randomBytes(32).toString('hex')"
    if ($LASTEXITCODE -ne 0 -or $progressToken -notmatch '^[0-9a-f]{64}$') {
        throw 'No se pudo crear la credencial local de progreso.'
    }
    "PROGRESS_SERVICE_TOKEN=$progressToken" |
        Set-Content -Encoding Ascii .cache/progress-local.env
}

if (!(Test-Path .cache/progress-local.compose.yml)) {
    @'
services:
  progress-api:
    env_file:
      - .cache/progress-local.env
'@ | Set-Content -Encoding Ascii .cache/progress-local.compose.yml
}

if (!(Test-Path .cache/progress-redis.compose.yml)) {
    @'
services:
  progress-api:
    environment:
      PROGRESS_REDIS_URL: redis://redis:6379
      REDIS_PASSWORD: ${REDIS_PASSWORD:?Required}
'@ | Set-Content -Encoding Ascii .cache/progress-redis.compose.yml
}
```

Con Cassandra y ClickHouse saludables, aplica las migraciones en orden y
despliega solo Express. Si un comando falla, corrígelo antes de continuar.

```powershell
Get-ChildItem services/progress-api/cassandra -Filter '*.cql' |
    Sort-Object Name | ForEach-Object {
        Get-Content -LiteralPath $_.FullName -Raw |
            docker exec -i siare-academico-cassandra-1 cqlsh
        if ($LASTEXITCODE -ne 0) { throw "Falló $($_.Name)" }
    }

Get-Content services/progress-api/clickhouse/001-attempt-ingestion.sql -Raw |
    docker exec -i siare-academico-clickhouse-1 sh -ec 'exec clickhouse-client --user "$CLICKHOUSE_USER" --password "$CLICKHOUSE_PASSWORD" --database "$CLICKHOUSE_DB" --multiquery'
if ($LASTEXITCODE -ne 0) { throw 'Falló la migración de ClickHouse' }

docker compose -f compose.datos.yml -f compose.apps.yml --env-file .env build progress-api
if ($LASTEXITCODE -ne 0) { throw 'Falló la construcción de Express' }

docker compose -f compose.datos.yml -f compose.apps.yml -f .cache/progress-local.compose.yml -f .cache/progress-redis.compose.yml --env-file .env up -d --no-deps --no-build --wait progress-api
if ($LASTEXITCODE -ne 0) { throw 'Express no quedó listo' }

docker exec siare-academico-progress-api-1 node dist/backfill-progress.js
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-Siare.ps1
```

El comando histórico reconstruye el progreso de intentos anteriores sin
duplicar conteos. El proceso de Express carga en segundo plano los intentos
pendientes en ClickHouse. Para reconstrucciones posteriores, usa los mismos
overrides al recrear Express para conservar la autenticación y Redis.

## Entrega al líder técnico

1. Configurar en Spring el mismo secreto de servicio mediante el mecanismo
   acordado con el equipo. El destino de contenedor es `http://progress-api:3001`.
2. Conectar el publicador HTTP de la cola de intentos de Spring. Confirmar la
   entrega con un acuse válido `201` o `200`. Reintentar timeouts y `503`
   conservando el evento, y revisar los conflictos `409` según su código.
3. Consumir las lecturas por medio de Spring, después de validar la identidad,
   la propiedad de la materia y el alcance. Usar `nextCursor` para paginación
   y `asOf` para informar la frescura de los indicadores.
4. Acordar con Nicolás el contrato de observaciones por tema. Los eventos
   entregados hoy traen resultado por actividad. La conexión real con
   Spring y su presentación en web o Android quedan por validar con el equipo.

Las [evidencias y comandos de prueba](ANALITICA_VALIDACION.md) registran
las comprobaciones efectuadas con datos sintéticos.
