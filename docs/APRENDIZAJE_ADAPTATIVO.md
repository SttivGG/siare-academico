# SIARE Académico | Arquitectura y desarrollo del aprendizaje adaptativo

**Estado del documento:** aprobado para desarrollo v1
**Fecha:** 24 de noviembre de 2026
**Ámbito:** `services/content-ai/` con integración futura de Spring, Express y clientes

Este documento es la fuente de verdad para comprender las decisiones, límites y evolución del aprendizaje adaptativo de SIARE. Describe lo implementado, lo acordado y lo que permanece pendiente. No presenta datos sintéticos como resultados reales ni sustituye la aprobación formal de una taxonomía, un dataset o una clasificación académica.

## 1. Propósito

SIARE debe ayudar a cada estudiante a estudiar a partir de actividades, documentos y temas que tenga disponibles, y mostrar el progreso obtenido a lo largo del tiempo.

El objetivo final comprende:

1. Permitir que el estudiante cargue o seleccione material académico.
2. Asociar ese material con temas y unidades de estudio.
3. Generar o evaluar actividades sobre el contenido disponible.
4. Registrar intentos evaluados con identidad y ámbito verificables.
5. Medir progreso por estudiante, materia, documento y tema.
6. Identificar necesidades de refuerzo sin tomar decisiones académicas automáticas.
7. Entrenar progresivamente un modelo propio con datos reales autorizados y pseudonimizados.
8. Reemplazar el modelo sin modificar los contratos de Spring o Flask.

El sistema no puede afirmar que un estudiante va a reprobar, no tiene capacidad ni requiere un diagnóstico psicológico o académico. Las respuestas son recomendaciones educativas revisables.

## 2. Arquitectura objetivo

```text
Estudiante
   |
   | JWT y permisos
   v
Spring
   |- autoriza usuario y materia
   |- evalua actividades
   |- prepara observaciones autorizadas
   |- mantiene identidad oficial
   |
   +--> Flask /internal/v1/learning/analyses
   |       |- valida contrato
   |       |- autentica al llamador Spring
   |       |- prepara caracteristicas
   |       |- carga el modelo versionado
   |       |- devuelve dificultad y recomendaciones
   |
   +--> Express / progresos e intentos
           |- persiste intentos evaluados
           |- consulta progreso e indicadores
```

Responsabilidades:

| Componente | Autoridad | No puede hacer |
|---|---|---|
| Cliente web/móvil | Iniciar actividad y visualizar recomendaciones aprobadas | Llamar Flask ni conocer secretos internos |
| Spring | Identidad, permisos, materias, actividades y construcción de observaciones | Exponer datos internos sin autorización |
| Flask | Validación, extracción, características e inferencia | Consultar MySQL/Cassandra ni autorizar usuarios |
| Express | Registro y consulta de intentos/progreso | Ser fuente de verdad no autorizada del usuario |
| Analítica | Dataset, métricas y evaluación offline | Entrenar dentro de una petición HTTP |

## 3. Límites actuales

Implementado y comprobado:

- Servicio Flask existente de extracción documental.
- Arquitectura MVC del servicio Python.
- Controlador interno actual de aprendizaje.
- Fixture sintético de intentos.
- Baseline reproducible de tasa de errores.
- Clasificador de regresión logística para experimentación offline.
- División temporal y características temporales en las pruebas.
- Evidencia insuficiente por número de intentos.
- Autenticación con secreto interno separado.
- Pruebas unitarias y de API sintéticas.
- Benchmark secuencial/paralelo acotado.
- Dependencias NumPy y scikit-learn fijadas.

Pendiente:

- Contrato Spring–Flask aprobado formalmente y migrado al nombre definitivo.
- Taxonomía oficial y formato definitivo de `topicId`.
- Modelo real entrenado y cargado desde un artefacto aprobado.
- Dataset real autorizado y pseudonimizado.
- División temporal real y métricas mínimas aprobadas.
- Umbrales finales de evidencia, riesgo y recomendación.
- Integración real con Spring y el esquema MySQL actual.
- Permisos públicos y autorización docente.
- Política de retención, eliminación y auditoría.
- Persistencia y recuperación del progreso.

## 4. Contrato Spring–Flask v1

### 4.1 Ruta objetivo

```http
POST /internal/v1/learning/analyses
Authorization: Bearer <LEARNING_SERVICE_TOKEN>
X-Request-Id: <UUID>
Content-Type: application/json
```

La ruta actual implementada es `POST /internal/v1/learning/analyze`. Es una implementación sintética previa que debe migrarse a `/analyses` al aprobar la integración conjunta. Ninguna ruta será considerada aprobada hasta actualizar Spring, Flask, pruebas y documentación.

El endpoint:

- Es síncrono y acotado.
- No ejecuta entrenamiento.
- No persiste observaciones nuevas.
- No consulta bases directamente.
- No recibe JWT de usuario.
- No recibe nombres, correos, documentos personales, claves o texto libre.

### 4.2 Solicitud

```json
{
  "schemaVersion": 1,
  "requestId": "00000000-0000-4000-8000-000000000001",
  "studentId": "00000000-0000-4000-8000-000000000002",
  "subjectId": "00000000-0000-4000-8000-000000000003",
  "modelVersion": "adaptive-v1",
  "observations": [
    {
      "attemptId": "00000000-0000-4000-8000-000000000004",
      "topicId": "fracciones",
      "score": 0.4,
      "durationMs": 45000,
      "occurredAt": "2026-11-18T18:00:00Z"
    }
  ],
  "maxRecommendations": 3
}
```

Todos los campos son obligatorios en v1.

| Campo | Tipo | Validación |
|---|---|---|
| `schemaVersion` | entero | Exactamente `1` |
| `requestId` | UUID | UUID canónico; correlación de solicitud |
| `studentId` | UUID | Identidad sintética o pseudónimo autorizado |
| `subjectId` | UUID | Materia que Spring verificó |
| `modelVersion` | texto | 1–64 caracteres; coincide con artefacto disponible |
| `observations` | lista | 1–1000 elementos |
| `attemptId` | UUID | Único dentro de la solicitud |
| `topicId` | texto/UUID | Identificador estable acordado; actualmente texto temporal |
| `score` | número finito | Entre `0.0` y `1.0` |
| `durationMs` | entero | Entre `0` y `86400000` |
| `occurredAt` | fecha UTC ISO 8601 | Debe incluir zona horaria |
| `maxRecommendations` | entero | Entre `1` y `10` |

Spring normaliza los datos antes de enviarlos. Flask no convierte cadenas numéricas ni deduce permisos.

### 4.3 Respuesta objetivo

```json
{
  "schemaVersion": 1,
  "requestId": "00000000-0000-4000-8000-000000000001",
  "studentId": "00000000-0000-4000-8000-000000000002",
  "subjectId": "00000000-0000-4000-8000-000000000003",
  "modelVersion": "baseline-error-rate-v1",
  "analyzedAt": "2026-11-18T18:01:00Z",
  "insufficientEvidence": false,
  "difficulties": [
    {
      "topicId": "fracciones",
      "difficultyScore": 0.8,
      "observationCount": 12
    }
  ],
  "recommendations": [
    {
      "topicId": "fracciones",
      "priority": 1,
      "action": "PRACTICE_TOPIC",
      "reasonCode": "LOW_MASTERY"
    }
  ]
}
```

`difficultyScore` es una medida relativa de dificultad mientras no exista calibración demostrada. No se muestra como probabilidad real de fracaso.

Las propiedades de dificultad y recomendación se calculan por tema. Cada tema de salida debe pertenecer a las observaciones recibidas.

### 4.4 Evidencia insuficiente

Existe evidencia insuficiente si no se alcanza el mínimo configurado por tema.

La configuración inicial propuesta es:

| Parámetro | Valor inicial |
|---|---:|
| Intentos mínimos por estudiante y tema | 5 |
| Intentos agregados mínimos por tema | 20 |
| Estudiantes mínimos para agregados de cohorte | 10 |
| Ventana inicial | 30 días |

Estos valores son experimentales y deben configurarse, no codificarse dentro de la lógica o presentarse como política aprobada.

Comportamiento recomendado:

- Sin observaciones válidas: `422 INSUFFICIENT_DATA`.
- Observaciones válidas por debajo del mínimo: `200` con `insufficientEvidence=true`.
- Modelo solicitado inexistente: `503 MODEL_UNAVAILABLE`.
- No existe predicción de alto riesgo por ausencia de datos.

### 4.5 Errores

```json
{
  "requestId": "00000000-0000-4000-8000-000000000001",
  "status": 422,
  "code": "INSUFFICIENT_DATA",
  "message": "No hay observaciones suficientes.",
  "fields": {}
}
```

| HTTP | Código |
|---|---|
| 400 | `VALIDATION`, `UNSUPPORTED_SCHEMA_VERSION` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 409 | `IDEMPOTENCY_CONFLICT`, `ATTEMPT_CONFLICT` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 422 | `INSUFFICIENT_DATA` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` |
| 503 | `MODEL_UNAVAILABLE`, `SERVICE_BUSY`, `DEPENDENCY_UNAVAILABLE` |

Los errores no incluyen stack, SQL, cuerpos privados, credenciales ni observaciones completas.

### 4.6 Seguridad

- Spring invoca Flask con `LEARNING_SERVICE_TOKEN`.
- El secreto es independiente de `CONTENT_SERVICE_TOKEN`, OIDC y sesiones.
- El secreto debe tener al menos 32 caracteres y puede rotarse sin alterar contratos.
- Flask no autentica ni autoriza identidades humanas por sí solo.
- Spring verifica identidad y propiedad antes de la llamada.
- Los clientes no reciben ni usan el secreto interno.
- CORS no constituye autenticación interna.
- Las respuestas usan `Cache-Control: no-store`.
- Los logs no contienen credenciales, nombres, documentos, respuestas ni cuerpos completos.

## 5. Taxonomía y `topicId`

### Estado

La implementación H3 usa un campo `topic` textual de hasta 100 caracteres en `academic_activities`. No existe todavía:

- Catálogo curricular oficial.
- Jerarquía persistente.
- UUID oficial de tema.
- Versionado de taxonomía.
- Relación segura entre toda actividad y tema.

### Evolución aprobada

MVP sintético:

```text
topicId = identificador textual estable temporal
```

Ejemplo:

```text
m1.algebra.fracciones
```

Producción:

```text
topicId = UUID persistido en catálogo administrado por Spring
```

El catálogo deberá conservar:

- Identificador estable.
- Nombre visible.
- Materia.
- Unidad.
- Tema padre.
- Subtema opcional.
- Estado activo/eliminado.
- Versión.

No se debe construir el identificador definitivo a partir de texto libre que puede cambiar.

## 6. Esquema real de intentos

Fuente autoritativa actual:

- Motor: MySQL.
- Tabla: `academic_attempts`.
- Tabla relacionada: `academic_activities`.
- Tabla de eventos: `academic_attempt_outbox`.

| Campo | Columna o origen | Disponibilidad |
|---|---|---|
| `attemptId` | `academic_attempts.id` | Disponible |
| `studentId` | `student_id` autenticado | Disponible |
| `subjectId` | Materia de `academic_activities.subject_id` | Disponible |
| `activityId` | `activity_id` | Disponible |
| `score` | `score` normalizado 0–1 | Disponible |
| `durationMs` | `duration_ms` | Disponible |
| `occurredAt` | `occurred_at` | Disponible |
| `topicId` | `academic_activities.topic` | Texto provisional |
| `startedAt` | No persistido con ese nombre | Pendiente |
| `correctAnswers` | Puede existir dentro de `result_json` | Requiere transformación |
| `totalAnswers` | Puede existir dentro de `result_json` | Requiere transformación |
| `attemptCount` | Agregación | Requiere consulta |
| `attemptNumber` | No persistido | Pendiente |
| `difficulty` | No persistido | Pendiente |

Spring debe preparar observaciones y validar su procedencia. Flask no puede leer MySQL ni aceptar resultados enviados directamente por el cliente como datos autoritativos.

## 7. Modelo actual

### Baseline

La primera versión disponible es `baseline-error-rate-v1`:

```text
riskScore = intentos incorrectos / intentos totales
```

Se utiliza si existen al menos cinco intentos configurables por tema. Es una línea base transparente y no es Machine Learning supervisado.

### Modelo supervisado experimental

Existe una implementación de regresión logística reproducible con:

- Escalado estándar.
- Clase balanceada.
- Semilla `20261123`.
- Hasta 500 iteraciones.
- Exportación segura de media, escala, coeficientes e intercepto.
- Sin serialización `pickle`.

La clase positiva y el umbral deben estar documentados antes de llamar al resultado una probabilidad de riesgo.

## 8. Características

Las características iniciales se derivan únicamente de observaciones anteriores al instante de decisión:

1. Porcentaje de aciertos.
2. Tasa de errores.
3. Número de intentos.
4. Duración promedio.
5. Tendencia temporal reciente.
6. Tiempo desde el último intento.
7. Errores consecutivos.

Prohibido:

- Utilizar el resultado futuro o el intento que se predice.
- Utilizar observaciones posteriores al corte.
- Mezclar información de otra materia sin documentarlo.
- Mezclar identidades sin separación temporal o pseudonimización.
- Utilizar nombres, correo, documento, respuestas libres o texto completo.

## 9. Entrenamiento y despliegue

El entrenamiento debe ocurrir fuera de las solicitudes HTTP:

```text
Datos pseudonimizados
   -> corte temporal
   -> limpieza
   -> división cronológica
   -> características
   -> baseline
   -> entrenamiento
   -> evaluación
   -> exportación segura
   -> aprobación
   -> carga al modelo
   -> inferencia
```

El artefacto opcional se configura mediante `LEARNING_MODEL_PATH`. Si está vacío o no es válido, Flask conserva `baseline-error-rate-v1`; no genera ni carga un modelo ficticio.

El artefacto debe incluir:

```json
{
  "schemaVersion": 1,
  "modelVersion": "adaptive-logistic-v1",
  "algorithm": "logistic_regression",
  "featureNames": [
    "scoreMean",
    "errorRate",
    "attemptCount",
    "durationMean",
    "recentTrend",
    "recencyDays"
  ],
  "minimumObservations": 5,
  "threshold": 0.5,
  "createdAt": "2026-11-24T00:00:00Z",
  "mean": [],
  "scale": [],
  "coefficients": [],
  "intercept": 0.0
}
```

`featureNames` fija el orden exacto de cálculo. `mean` y `scale` representan normalización; `coefficients` e `intercept` representan el modelo lineal. El umbral y las métricas deben aprobarse antes de utilizarlo.

No se debe entrenar ni calcular artefactos en `POST`.

## 10. Evaluación obligatoria

Para datos sintéticos:

- Semilla fija.
- Fixture versionada.
- División temporal reproducible.
- Sin fuga temporal.
- Sin fuga de identidad si corresponde.
- Baseline comparado con el modelo.

Para datos reales:

- Autorización documentada.
- Pseudonimización previa.
- Fecha de corte aprobada.
- Division temporal estricta.
- Precision.
- Recall.
- F1.
- AUC.
- Matriz de confusión.
- Accuracy como complemento.
- Tamaño de muestra.
- Análisis de desbalance.
- Comparación contra baseline.
- Intervalos o incertidumbre si son viables.
- Segmentación por materia/cohorte solo con privacidad suficiente.

Los umbrales mínimos no quedan aprobados automáticamente por este documento. Deben registrarse junto con los datos reales y la evaluación.

## 11. Recomendaciones

Se utiliza el concepto de prioridad de refuerzo académico, no de diagnóstico o probabilidad de fracaso.

Acciones iniciales:

- `REVIEW_TOPIC`: repasar el tema.
- `PRACTICE_TOPIC`: practicar el tema.
- `MAINTAIN`: mantener el nivel si el baseline indica suficiente dominio.

Ejemplos aceptables:

```text
“Se recomienda reforzar este tema mediante una nueva actividad de práctica”.
```

Ejemplos prohibidos:

```text
“Vas a reprobar”.
“No tienes capacidad para esta materia”.
“El modelo demuestra que no puedes aprender este contenido”.
```

Las recomendaciones no modifican calificaciones, restringen actividades ni toman decisiones académicas automáticas.

## 12. Datos y privacidad

Flask no debe persistir una copia nueva de los intentos recibidos para inferencia.

Antes de usar datos reales se debe aprobar:

- Finalidad del tratamiento.
- Responsable autorizado.
- Origen de datos.
- Pseudonimización.
- Periodo histórico.
- Fecha de corte.
- Tamaño y representatividad.
- Exclusiones y sesgos.
- Retención.
- Acceso.
- Eliminación.
- Supresión propagada a datasets y modelos.

Los identificadores de entrenamiento no pueden ser el UUID interno de cuenta sin una pseudonimización diseñada para ML.

## 13. Paralelismo

El paralelismo debe demostrarse en una operación algorítmica real del módulo ML, no solo por aceptar múltiples peticiones HTTP.

El experimento inicial debe:

- Usar dos trabajadores como máximo.
- Preparar lote sintético reproducible.
- Comparar secuencial y paralelo.
- Medir tiempo total y mediana.
- Medir variabilidad.
- Medir memoria pico.
- Medir uso de CPU disponible.
- Documentar cuándo el paralelismo empeora el rendimiento.
- Ejecutarse fuera de las peticiones productivas si consume demasiada memoria.

Flask no debe crear pools ilimitados ni entrenar durante el request.

## 14. Evidencia verificable actual

Los resultados actuales deben describirse como:

- Contrato sintético implementado y probado.
- Baseline sintético implementado y probado.
- Características temporales con datos sintéticos.
- Regresión logística reproducible disponible para evaluación offline.
- API interna protegida y acotada.
- Pruebas del módulo.
- Benchmark secuencial/paralelo.

No están acreditados:

- Superioridad sobre datos reales.
- Calibración.
- Política final de umbrales.
- Taxonomía oficial.
- Contrato aprobado por Spring.
- Permisos docentes.
- Retención legal definitiva.
- Integración real con Express.

## 15. Plan de implementación

### Fase A — Consolidación del contrato

- Aprobar `POST /internal/v1/learning/analyses`.
- Migrar pruebas y documentación.
- Añadir `X-Request-Id`.
- Definir comportamiento insuficiente.
- Mantener compatibilidad temporal solo si Spring la requiere.

### Fase B — Modelo intercambiable

- Mantener el baseline como fallback.
- Añadir carga de artefacto al arrancar.
- Validar `modelVersion` y características.
- Separar entrenamiento e inferencia.
- Rechazar artefactos incompatibles.

### Fase C — Persistencia de progreso

- Registrar intentos evaluados.
- Añadir actividad–tema.
- Mantener fecha de inicio si el equipo la aprueba.
- Enviar datos a analítica sin datos personales.
- Consultar progreso por estudiante y materia.

### Fase D — Dataset real

- Autorizar extracción.
- Pseudonimizar.
- Versionar dataset.
- Dividir temporalmente.
- Evaluar baseline y modelo.
- Registrar aprobación y límites.

### Fase E — Estudio a partir de archivos

- Integrar el texto ya extraído.
- Asociar fragmentos con temas.
- Generar actividades controladas.
- Recuperar contexto relevante al tema.
- Registrar el resultado como nuevo intento.
- Evaluar progreso por unidad.

Nota: esta fase no puede mezclar contenido privado de un usuario con el de otros usuarios.

## 16. Convenciones para nuevos desarrolladores

### Git

- Trabajar en rama propia desde `origin/main`.
- Limitar commits al ámbito autorizado.
- No modificar secretos, Compose, Spring, Express o frontend sin autorización.
- No usar `git reset --hard` ni `docker compose down -v` sin instrucción explícita.
- Crear PR hacia `main` sin fusionar automáticamente.

### Python

- Mantener MVC de Flask.
- Ejecutar ML fuera de controladores cuando implique cómputo extenso.
- Validar todos los campos JSON.
- No usar nombres de usuario o texto completo como identificadores.
- Mantener fixtures sintéticas bajo control de versión.
- Actualizar requisitos y lock antes de cambiar dependencias.

### Pruebas

```powershell
cd services/content-ai
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m benchmarks.learning_parallel_benchmark
```

Toda entrega debe conservar extracción y OCR. Las pruebas de ML no sustituyen las pruebas existentes de OCR.

## 17. Documentación relacionada

- `docs/CONTRATOS_EQUIPO.md`
- `docs/PLAN_ENTREGA_2026_2.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTRATO_API_MOBILE.md`
- `services/content-ai/docs/ML_IMPLEMENTACION.md`
- `services/content-ai/docs/ML_VALIDACION.md`
- `docs/DATOS_MODELOS_ML.md`

Ante una diferencia entre documentos, este documento define las decisiones aprobadas para desarrollo; una prueba o migración incompatible requiere actualizarlo y registrar el cambio en el PR.
