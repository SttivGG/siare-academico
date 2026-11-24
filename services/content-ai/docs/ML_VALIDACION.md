# Validación ML

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