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

El acuse contiene `analyticsStatus: PENDING`. El envío HTTP desde Spring y la caché Redis se incorporan en bloques posteriores. Express queda en la red interna de Compose.

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

## Consultar progreso por actividad

`GET /internal/v1/students/{studentId}/progress?subjectId=<UUID>&limit=20`
usa el mismo Bearer interno y la cabecera `X-Request-Id`. Responde con
`items`: cada actividad tiene `attemptCount`, `bestScore`, `lastScore` y
`lastAttemptAt`. Se acepta un límite de 1 a 100 y un `cursor` devuelto
como `nextCursor` para continuar. Al terminar, `nextCursor` es nulo.

La lectura se ordena por `activityId` y el cursor solo se acepta para el
mismo estudiante y materia. La paginación lee el estado disponible en cada
solicitud. Si aparece una actividad por delante del cursor, puede entrar
en las páginas restantes. Si aparece por detrás, se ve al empezar una
consulta nueva. `asOf` indica cuándo se leyó esa página. La última nota se
elige por la fecha del evento, con desempate por `attemptId`.

La migración `002-progress.cql` crea 16 grupos por estudiante y materia
según el primer dígito de `activityId`. Cada grupo permite leer solo filas
resumen. Cassandra confirma juntos el resumen actualizado y la marca del
intento en un lote condicional en la misma partición. Un reintento puede
reparar un resumen pendiente tras la escritura original y nunca
incrementa dos veces el conteo. Las marcas se conservan para que la
reconstrucción histórica sea repetible.

Aplica las migraciones en orden, reconstruye y recrea solo Express con
los comandos anteriores y reconstruye los resúmenes históricos. El
proceso lee páginas de 100 registros y admite repetición:

```powershell
Get-Content services/progress-api/cassandra/002-progress.cql -Raw |
    docker exec -i siare-academico-cassandra-1 cqlsh
# Después de desplegar la nueva imagen de Express:
docker exec siare-academico-progress-api-1 node dist/backfill-progress.js
Get-Content services/progress-api/test/progress.integration.mjs -Raw |
    docker exec -i siare-academico-progress-api-1 node --input-type=module -
```

La prueba comprueba conteos concurrentes, notas, orden temporal, aislamiento,
cursor inválido y cambios entre páginas. Spring conserva la autorización
del estudiante y la materia antes de llamar a este servicio interno.

## Indicadores e ingesta en ClickHouse

`GET /internal/v1/students/{studentId}/indicators?subjectId=<UUID>&from=<UTC>&to=<UTC>`
usa el Bearer interno y `X-Request-Id`. El intervalo es `[from,to)`, de
hasta 31 días, con precisión de milisegundos. Responde con `attemptCount`,
`averageScore` y `totalDurationMs`. Sin datos, el conteo y la duración
son cero, y el promedio y los campos de frescura son nulos. Si ClickHouse
no está disponible, devuelve 503.

`asOf` es el mayor instante de primera ingesta visible entre los eventos
únicos del resultado. `ingestionLagMs` mide los milisegundos transcurridos
entre el registro en Cassandra y la primera ingesta del evento asociado a
ese instante. La consulta es eventualmente consistente. El estado
`analyticsStatus: PENDING` del POST indica que la aceptación del intento
no espera una confirmación analítica.

Express recorre Cassandra en páginas de 32 intentos y envía solo los
pendientes. Cassandra registra la confirmación después de que ClickHouse
acepta el lote. Si falla el envío o la confirmación, el proceso reintenta
con espera creciente hasta 30 segundos. Al reiniciar, el recorrido vuelve
a empezar y reutiliza las confirmaciones duraderas. La paginación limita
el trabajo por iteración, aunque cada ciclo recorre la tabla de intentos.
El tiempo de una vuelta completa crecerá con el historial.

ClickHouse conserva `academic_events` y recibe columnas nuevas para
registro e ingesta. Si ClickHouse aceptó un lote pero Cassandra no pudo
guardar su confirmación, el reintento puede insertar otra fila física.
Los indicadores agrupan por `event_id` antes de calcular conteo, media y
duración. La primera ingesta se conserva al consultar por duplicado.

Desde la raíz, con los servicios locales levantados, aplica estas
migraciones antes de reconstruir y recrear Express como se indicó arriba:

```powershell
Get-Content services/progress-api/cassandra/003-analytics-delivery.cql -Raw |
    docker exec -i siare-academico-cassandra-1 cqlsh
Get-Content services/progress-api/clickhouse/001-attempt-ingestion.sql -Raw |
    docker exec -i siare-academico-clickhouse-1 sh -ec 'exec clickhouse-client --user "$CLICKHOUSE_USER" --password "$CLICKHOUSE_PASSWORD" --database "$CLICKHOUSE_DB" --multiquery'
```

La prueba `test/analytics.integration.mjs` tiene dos fases. Define una
semilla única y conserva la misma para ambas. En `outage`, usa un
override local de Compose que cambie únicamente `CLICKHOUSE_URL` de
Express a un destino inaccesible (por ejemplo `http://127.0.0.1:1`).
En `recover`, vuelve a recrear únicamente Express con su configuración
normal. Las dos fases pueden ejecutarse por stdin sin copiar archivos
al contenedor:

```powershell
$seed = [guid]::NewGuid().ToString()
$test = Get-Content services/progress-api/test/analytics.integration.mjs -Raw
# Con la conexión de Express a ClickHouse interrumpida:
$test | docker exec -i siare-academico-progress-api-1 node --input-type=module - outage $seed
# Después de restaurar la configuración normal de Express:
$test | docker exec -i siare-academico-progress-api-1 node --input-type=module - recover $seed
```

La segunda fase verifica los totales conocidos, la exclusión del extremo
final del intervalo, el aislamiento y la ingesta atrasada. Inserta
deliberadamente otra fila para un evento sintético y comprueba que cambian
las filas físicas pero se conservan todos sus indicadores.
