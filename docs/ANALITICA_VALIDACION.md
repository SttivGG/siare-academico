# Validación de progreso y analítica

**Responsable:** Maicol Castillo  
**Fecha local:** 21 de noviembre de 2026  
**Rama:** `feature/progress-analytics`  
**Código validado:** `9611531`.

El despliegue de prueba ejecutó Express, Cassandra, ClickHouse y Redis en la
instalación Docker local de SIARE. Los eventos eran sintéticos y se enviaron a
los endpoints reales de Express. Las fallas de ClickHouse y Redis se
reprodujeron cambiando temporalmente la dirección que usaba Express.
La entrega automática desde Spring aún requiere una prueba con su adaptador.

## Evidencias de aceptación

| Caso | Resultado observado |
| --- | --- |
| Compilación y suite automatizada | TypeScript compiló y pasaron **10 pruebas** de Express, validación HTTP y caché. |
| Registro concurrente en Cassandra | **12** solicitudes idénticas dejaron un solo intento. Un `201` y once `200`. Los conflictos por evento e intento devolvieron `409`. |
| Reinicio y recuperación | Al repetir el evento tras reiniciar Express se conservó `recordedAt`. Un intento durable sin la marca de progreso se reparó al reenviar. |
| Progreso por actividad | Dos intentos y un reenvío devolvieron **2 intentos**, mejor nota **0,8** y última **0,6**. Se verificaron tres páginas, aislamiento por estudiante y materia, desempate y nuevas escrituras entre páginas. |
| Reconstrucción histórica | Repetir la reconstrucción conservó el conteo de **3 intentos históricos en 2 actividades** de la muestra. |
| Ingesta y falla de ClickHouse | Cassandra conservó **4 intentos pendientes** durante la interrupción de Express hacia ClickHouse. Tras restablecer la conexión se entregaron. El intervalo de la prueba devolvió **2 intentos**, promedio **0,70**, duración **100.000 ms** y un retraso observado de **6.635 ms**. |
| Duplicación física en ClickHouse | Insertar otra fila para el mismo evento dejó inalterados el conteo, el promedio, la duración y la primera ingesta de la consulta. |
| Redis real | Se observaron aciertos y fallos de caché. El TTL de prueba de **4 s** venció en ambas vistas. Se comprobó invalidación tras registro e ingesta y se dejó el TTL habitual de **60 s**. |
| Contingencia y carrera de caché | Sin acceso a Redis, Express siguió registrando y consultando Cassandra y ClickHouse. Una lectura anterior a la invalidación solo escribió en la generación antigua. |
| Instalación y regresión | Se verificaron los **9 servicios saludables**, conexiones a **5 motores** y la pantalla de inicio de sesión local con HTTP **200**. |

La prueba de fallo mide recuperación funcional de esta instalación. El retraso
de ingesta publicado en la tabla corresponde a ese ensayo con reconexión y no
es un objetivo permanente de disponibilidad.

Se validó el documento con OpenAPI 3.1 y se comprobaron **24 ejemplos** y
**16 respuestas HTTP reales** contra sus esquemas JSON. Se incluyeron las cinco
rutas, reenvío, los dos conflictos, autenticación, validación, límite del
cuerpo y tipo de contenido. Las respuestas se recogieron de la instancia
local usando un quiz sintético.

## Capturas

- [Pantalla de inicio de sesión de SIARE en la instalación local](evidencias/progreso/01-web-local.png).
- [Captura del informe generado a partir de las salidas reales de la API, las pruebas y el benchmark](evidencias/progreso/02-pruebas-locales.png).

La captura de la web muestra la aplicación desplegada. La revisión funcional de
analítica se realizó a través de la API interna.

## Benchmark

Se compararon **1, 5, 10 y 20** solicitudes simultáneas con dos rondas y 20
solicitudes por caso. Hubo **640 solicitudes por versión y 0 errores**.
A 20 simultáneas, el p95 medio de reenvíos bajó de **470,17 a 251,00 ms** y
el de escrituras nuevas sobre la misma actividad de **1.072,43 a 844,11 ms**.
Las lecturas a Cassandra para dos ráfagas sobre la misma clave fría bajaron
de **40 a 2**, y las invalidaciones por reenvíos confirmados de **40 a 0**.
El RSS máximo de Express fue de **106,1 MiB** antes y **108,6 MiB** después
con un límite de contenedor de **256 MiB**. La mejora no fue uniforme en
todos los niveles. El [informe de rendimiento](../services/progress-api/PERFORMANCE.md)
contiene el detalle de p50, p95, solicitudes/s, CPU, memoria y metodología.

## Reproducir

Desde la raíz, con la instancia local saludable y los overrides de
autenticación y Redis descritos en [Implementación](PROGRESO_IMPLEMENTACION.md):

```powershell
npm.cmd --prefix services/progress-api ci
npm.cmd --prefix services/progress-api test

Get-Content services/progress-api/test/attempts.integration.mjs -Raw |
    docker exec -i siare-academico-progress-api-1 node --input-type=module -

Get-Content services/progress-api/test/progress.integration.mjs -Raw |
    docker exec -i siare-academico-progress-api-1 node --input-type=module -

Get-Content services/progress-api/test/concurrency.benchmark.mjs -Raw |
    docker exec -i siare-academico-progress-api-1 node --input-type=module - 20 2

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-Siare.ps1
```

Para repetir la [prueba de caída de ClickHouse](../services/progress-api/README.md#indicadores-e-ingesta-en-clickhouse)
o la [prueba de Redis](../services/progress-api/README.md#caché-redis-de-progreso-e-indicadores),
usa los overrides temporales documentados en el módulo. Los resultados crudos
se conservan localmente en `.cache`, ignorados por Git.
