# Validación ML

## Alcance de la versión actual

Esta versión entrega una implementación ML reproducible sobre datos sintéticos. No es
un modelo entrenado con intentos reales ni acredita calidad académica sobre estudiantes.
Gemini permanece separado y se usa para generación; la regresión logística demuestra
el análisis de dificultad supervisado de la primera versión.

## Evidencia sintética reproducible

Artefactos generados:

- `app/ml/artifacts/ml-v1.json`: parámetros JSON seguros sin pickle ni código ejecutable.
- `benchmarks/learning_synthetic_report.json`: métricas y partición sintética.
- Semilla: `20261123`.
- Participación temporal: partición posicional sobre filas ya ordenadas.
- Sin datos reales, identidad personal ni taxonomía aprobada.

Resultado de validación sintética reservada (138 filas):

- Modelo: accuracy `0.731884`, precision `0.825397`, recall `0.666667`, F1 `0.737589`, AUC `0.819444`.
- Baseline de tasa de errores: accuracy `0.565217`, precision `0.565217`, recall `1.000000`, F1 `0.722222`, AUC no disponible.
- Matriz del modelo: [[49, 11], [26, 52]].
- Matriz del baseline: [[0, 60], [0, 78]].

Esta mejora es demostrativa. No prueba superioridad en población real ni calibración.

## Estado verificable

- Contrato sintético implementado y probado.
- Baseline de tasa de errores implementado y probado.
- Características temporales implementadas sin usar intentos posteriores al corte.
- Regresión logística reproducible implementada con semilla fija.
- API interna autenticada, limitada por bytes e implementada con respuesta sin caché.
- Análisis concurrente por tema implementado con máximo cuatro hilos.

## Comandos

```text
cd services/content-ai
./.venv/Scripts/python.exe -m unittest discover -s tests -v
./.venv/Scripts/python.exe -m benchmarks.learning_parallel_benchmark
```

Docker ejecuta la suite completa y dispone de Tesseract español.

## Paralelismo medido

Benchmark sintético: 8 temas, 800 intentos, máximo 4 hilos, 5 repeticiones:

- Secuencial: mediana `0.000510 s`, mínimo `0.000377 s`, máximo `0.023584 s`, pico Python `1488 bytes`.
- Paralelo: mediana `0.003247 s`, mínimo `0.002978 s`, máximo `0.019006 s`, pico Python `26378 bytes`.

En esta carga el trabajo paralelo fue más lento por el overhead de crear hilos y repartir
trabajo pequeño. Se demuestra paralelismo real del análisis por tema, pero no se afirma
una aceleración. El código mantiene un límite de cuatro trabajadores y no se usa dentro
para entrenar ni crear pools ilimitados.

## Evidencia pendiente

No hay datos reales ni taxonomía aprobada. No se acredita:

- Métrica principal aprobada.
- Umbral mínimo de aprobación.
- AUC, recall, precision o F1 sobre datos reales.
- Superioridad respecto del baseline.
- Suficiencia real por estudiante y tema.
- Contrato aprobado con Spring.
- Política real de retención y privacidad.

## Criterio

El resultado actual demuestra comportamiento de baseline y pipelines sintéticos. No demuestra valor pedagógico hasta comparar una partición temporal real contra el baseline y registrar las métricas acordadas.