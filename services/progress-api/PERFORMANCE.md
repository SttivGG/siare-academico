# Concurrencia y rendimiento de progress-api

Medición local del 21 de noviembre de 2026 en `feature/progress-analytics`.
La referencia fue el commit `db5236f`. La versión medida incorpora el
recibo durable de progreso, las lecturas compartidas de caché y la cola
local de escrituras por partición de progreso.

## Repetir el ensayo

Con SIARE saludable, aplica `005-progress-confirmation.cql` además de las
migraciones anteriores. Recrea solo Express con los overrides locales de
autenticación y Redis documentados en el [README](README.md).

```powershell
Get-Content services/progress-api/cassandra/005-progress-confirmation.cql -Raw |
    docker exec -i siare-academico-cassandra-1 cqlsh
Get-Content services/progress-api/test/concurrency.benchmark.mjs -Raw |
    docker exec -i siare-academico-progress-api-1 node --input-type=module - 20 2 |
    Tee-Object -FilePath .cache/progress-benchmark.jsonl
```

Los dos argumentos indican solicitudes por caso y repeticiones. El
ensayo usa 1, 5, 10 y 20 solicitudes simultáneas, con orden invertido en
la segunda vuelta para reducir el efecto del calentamiento. Cada versión
ejecutó 32 casos y 640 solicitudes medidas. Las escrituras nuevas
compiten deliberadamente por la misma actividad de un estudiante
sintético. La preparación y la comprobación posterior en Cassandra y
ClickHouse quedan fuera de los tiempos medidos.

Docker Linux tenía 8 CPU visibles y 6,72 GiB de RAM disponible. Express
tenía un límite de 256 MiB. El generador ejecutó HTTP por loopback con Node
24.22.2 dentro del mismo contenedor que Express. El RSS y el tiempo de CPU
se midieron sobre el proceso de Express, con muestreo de RSS cada 100 ms
durante el caso y en los extremos. El generador comparte los recursos del
contenedor. Estos datos describen la prueba local, con el resto de SIARE
iniciado y la ingesta en segundo plano.

## Resultados antes y después

Los p50 y p95 están en milisegundos y representan el promedio de los
percentiles de las dos repeticiones. Las tasas y la CPU de Express
también se promediaron por caso. El pico de RSS fue **106,1 MiB** antes y
**108,6 MiB** después. Ambas versiones registraron **0 errores**.

| Carga | Concurrencia | p50 / p95 antes | p50 / p95 después | Solicitudes exitosas/s antes → después | CPU de Express en ms antes → después |
| --- | ---: | ---: | ---: | ---: | ---: |
| Escrituras nuevas | 1 | 35.80 / 70.37 | 52.89 / 93.10 | 26.83 → 19.72 | 250 → 460 |
| Escrituras nuevas | 5 | 113.48 / 367.62 | 192.82 / 302.44 | 26.85 → 24.23 | 235 → 275 |
| Escrituras nuevas | 10 | 310.98 / 753.59 | 796.23 / 1086.36 | 21.69 → 15.01 | 270 → 455 |
| Escrituras nuevas | 20 | 795.79 / 1072.43 | 654.52 / 844.11 | 18.17 → 23.32 | 385 → 215 |
| Reenvíos confirmados | 1 | 18.05 / 39.03 | 8.41 / 30.35 | 49.35 → 91.58 | 135 → 75 |
| Reenvíos confirmados | 5 | 129.30 / 202.87 | 86.22 / 144.57 | 36.50 → 56.29 | 165 → 115 |
| Reenvíos confirmados | 10 | 224.27 / 353.01 | 155.46 / 251.70 | 39.44 → 62.39 | 120 → 110 |
| Reenvíos confirmados | 20 | 354.69 / 470.17 | 210.86 / 251.00 | 37.97 → 78.58 | 120 → 75 |
| Progreso con clave fría | 1 | 7.28 / 54.10 | 7.59 / 58.79 | 62.49 → 58.92 | 105 → 100 |
| Progreso con clave fría | 5 | 88.83 / 194.52 | 77.97 / 136.17 | 49.75 → 61.85 | 140 → 105 |
| Progreso con clave fría | 10 | 138.35 / 254.60 | 242.89 / 474.98 | 57.75 → 41.43 | 140 → 255 |
| Progreso con clave fría | 20 | 307.48 / 393.18 | 253.46 / 283.30 | 50.38 → 67.54 | 145 → 85 |
| Indicadores con caché caliente | 1 | 7.25 / 55.68 | 7.29 / 57.75 | 66.69 → 66.98 | 85 → 95 |
| Indicadores con caché caliente | 5 | 51.35 / 93.98 | 60.51 / 139.62 | 83.35 → 69.94 | 70 → 105 |
| Indicadores con caché caliente | 10 | 102.94 / 154.42 | 195.67 / 287.91 | 82.12 → 45.67 | 60 → 80 |
| Indicadores con caché caliente | 20 | 152.84 / 163.63 | 177.74 / 182.81 | 131.00 → 104.92 | 55 → 55 |

## Mejoras verificadas

- **Reenvíos confirmados.** El intento conserva una marca durable escrita
  después de actualizar el progreso e invalidar su caché. Un reenvío que
  encuentra la marca devuelve el acuse anterior sin repetir esa
  invalidación. En dos rondas de 20 reenvíos simultáneos, las invalidaciones
  bajaron de 40 a 0 y el p95 promedio de 470,17 a 251,00 ms. La prueba de
  integración también verifica que un reenvío repara un intento previo
  sin marca.
- **Una lectura por clave fría.** Las solicitudes que comparten la misma
  clave y generación esperan una sola lectura de la fuente. En las dos
  ráfagas de 20 solicitudes, las lecturas de Cassandra bajaron de 40 a 2.
  Se probó que una lectura fallida libera la clave y que una lectura
  anterior a la invalidación solo puede llenar la generación anterior.
- **Escrituras a una misma partición.** Un proceso de Express ordena
  localmente las actualizaciones a esa partición y conserva el lote
  condicional de Cassandra para proteger el conteo entre procesos. A 20
  en paralelo, el p95 de escrituras nuevas pasó de 1072,43 a 844,11 ms y
  la tasa promedio de 18,17 a 23,32 solicitudes/s.

La concurrencia no mejoró todos los casos. Las escrituras con 10
solicitudes simultáneas fueron más lentas después del cambio y los
indicadores con caché caliente también variaron. Las dos repeticiones son
suficientes para verificar los conteos y observar el efecto local, pero
no para fijar capacidad de producción. El ensayo confirmó que los
reenvíos mantuvieron un solo intento y que los conteos, promedios y
duraciones de ClickHouse coincidieron con los eventos únicos esperados.
