# Registro interno de intentos

Spring evalúa la actividad y llama a `POST /internal/v1/attempts` con el evento
v1 documentado en [Contratos del equipo](../../docs/CONTRATOS_EQUIPO.md).
El registro acepta quiz y crucigrama con el mismo contrato. La autenticación
usa un Bearer interno `PROGRESS_SERVICE_TOKEN` (mínimo 32 caracteres ASCII
visibles). Se requieren `X-Request-Id` y `Idempotency-Key` iguales a UUID
canónicos, con `Idempotency-Key` igual a `eventId`. El JSON admite 1 MiB.

| Resultado | HTTP |
| --- | --- |
| Intento confirmado en Cassandra | 201 |
| Mismo evento y contenido canónico | 200, con el `recordedAt` original |
| Mismo evento con otros datos | 409 `IDEMPOTENCY_CONFLICT` |
| Otro evento para el mismo intento | 409 `ATTEMPT_CONFLICT` |
| Escritura sin confirmación | 503 `DEPENDENCY_UNAVAILABLE` |

## Persistencia y recuperación

La migración crea `siare_progress` para Cassandra local de un nodo en
`datacenter1`. Cada UUID ocupa su propia partición. Un `INSERT IF NOT EXISTS`
reserva `eventId` con una huella del evento canónico. Un segundo
`INSERT IF NOT EXISTS` almacena el evento completo por `attemptId`.
Si el proceso se interrumpe entre ambos pasos, Spring puede reenviar el
evento original para terminar el registro. Una reserva por sí sola no
confirma un intento. Si el intento pertenece a otro evento, Express libera
condicionalmente la reserva perdedora. Si hay incertidumbre sobre una
escritura, Express devuelve 503 y el llamante debe mantener el mismo evento
y clave al reintentar.

El acuse contiene `analyticsStatus: PENDING`. El envío HTTP desde Spring,
las consultas de progreso, ClickHouse y Redis se incorporan en bloques
posteriores. Express queda en la red interna de Compose.

## Prueba en la instalación local

Desde la raíz, con Cassandra y la instalación SIARE en funcionamiento:

```powershell
Get-Content services/progress-api/cassandra/001-attempts.cql -Raw |
    docker exec -i siare-academico-cassandra-1 cqlsh
```

En esta instalación se provisionaron `.cache/progress-local.env`, con la
credencial de servicio, y `.cache/progress-local.compose.yml`, que inyecta
ese archivo exclusivamente en Express. Ambos están ignorados por Git.
Para recrear Express con esa configuración, ejecuta la construcción y el
arranque selectivo:

```powershell
docker compose -f compose.datos.yml -f compose.apps.yml --env-file .env build progress-api
docker compose -f compose.datos.yml -f compose.apps.yml -f .cache/progress-local.compose.yml --env-file .env up -d --no-deps --no-build --wait progress-api
```

La suite normal usa `npm.cmd ci` y `npm.cmd test` dentro del módulo. El
ensayo de integración usa eventos sintéticos con un identificador único
por corrida. Verifica una sola creación con 12 solicitudes concurrentes,
conflictos de ambos IDs y recuperación de una reserva interrumpida. En
modo `replay` relee los mismos intentos y comprueba el acuse original.

```powershell
$seed = [guid]::NewGuid().ToString()
$test = Get-Content services/progress-api/test/attempts.integration.mjs -Raw
$test | docker exec -i siare-academico-progress-api-1 node --input-type=module - verify $seed
docker compose -f compose.datos.yml -f compose.apps.yml -f .cache/progress-local.compose.yml --env-file .env restart --no-deps progress-api
docker compose -f compose.datos.yml -f compose.apps.yml -f .cache/progress-local.compose.yml --env-file .env up -d --no-deps --no-build --wait progress-api
$test | docker exec -i siare-academico-progress-api-1 node --input-type=module - replay $seed
```
