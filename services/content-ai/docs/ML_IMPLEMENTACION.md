# Implementación de aprendizaje adaptativo

## Estado

- El baseline actual basado en tasa de errores es funcional y reproducible.
- Existe una regresión logística experimental exportable como parámetros JSON.
- Los fixtures son sintéticos y no acreditan resultados con datos reales.
- El contrato v1 está definido; el contrato anterior se conserva temporalmente como alias.

## Contrato interno

Ruta objetivo:

```text
POST /internal/v1/learning/analyses
```

Alias temporal compatible:

```text
POST /internal/v1/learning/analyze
```

La ruta objetivo recibió el contrato aprobado para desarrollo:

- `schemaVersion=1`.
- `requestId`, `studentId` y `subjectId` son UUID canónicos.
- `modelVersion` tiene entre 1 y 64 caracteres.
- `observations` contiene entre 1 y 1000 elementos.
- `attemptId` es UUID único dentro de la solicitud.
- `topicId` es textual estable temporalmente.
- `score` es finito y está entre 0 y 1.
- `durationMs` es entero entre 0 y 86400000.
- `occurredAt` incluye zona horaria ISO 8601.
- `maxRecommendations` está entre 1 y 10.

Recomendación del resultado:

```text
schemaVersion
requestId
studentId
subjectId
modelVersion
analyzedAt
insufficientEvidence
difficulties
recommendations
```

No declarar `difficultyScore` como probabilidad calibrada sin evaluación real.

## Evidencia insuficiente

El mínimo inicial es configurable y está fijado en cinco intentos por tema para desarrollo. Sin observaciones válidas se devuelve `422 INSUFFICIENT_DATA`. Con observaciones por debajo del mínimo puede devolverse `200` con `insufficientEvidence=true`.

Los valores 20 intentos por tema y 10 estudiantes para agregado son propuestas para experimentación, no políticas aprobadas.

## Separación de entrenamiento e inferencia

- El baseline puede calcularse en el servicio al analizar una solicitud.
- El modelo supervisado se entrena fuera de Flask.
- Flask carga parámetros/modelos versionados al iniciar o mediante configuración aprobada.
- Una solicitud HTTP no llama a `fit()` ni crea artefactos.
- Cada respuesta identifica la versión utilizada.

## Datos

La implementación actual conserva las pruebas sintéticas. La integración real debe recibir observaciones preparadas por Spring, con identidad autorizada y sin datos personales libres.

Spring debe obtener y transformar datos de `academic_attempts` y `academic_activities`. Flask no consulta MySQL, Cassandra o ClickHouse.

## Privacidad y seguridad

- `LEARNING_SERVICE_TOKEN` es independiente de `CONTENT_SERVICE_TOKEN`.
- Spring es responsable de autorización y permisos.
- Flask no persiste una copia nueva de las observaciones.
- Los logs no contienen identidad real, respuestas libres o credenciales.
- Las respuestas llevan `Cache-Control: no-store`.

## Modelo supervisado

- Algoritmo inicial: regresión logística con escalado.
- Semilla: `20261123`.
- División: temporal sin mezclar observaciones futuras.
- Exportación segura: parámetros JSON normales.
- Métricas: precision, recall, F1, AUC y matriz de confusión.
- Accuracy como métrica complementaria.
- Comparación obligatoria con el baseline de tasa de errores.

## Taxonomía temporal

Mientras no exista catálogo oficial, `topicId` puede ser una cadena estable sintética. No se debe presentar como taxonomía curricular. Producción requiere UUID persistido y versionado administrado por Spring.
