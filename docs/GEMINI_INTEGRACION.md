# Integración Gemini con SIARE Académico

## Estado

Gemini es un motor generativo externo utilizado exclusivamente desde `content-ai`.
No reemplaza el OCR, la extracción, el baseline, la regresión logística ni la persistencia.

## Componentes

- SDK oficial: `google-genai==3.6.1`.
- Cliente: `services/content-ai/app/generative/gemini_service.py`.
- Modelos: `services/content-ai/app/generative/models.py`.
- Prompts: `services/content-ai/app/generative/prompts.py`.
- Validadores: `services/content-ai/app/generative/validators.py`.
- Endpoints: `services/content-ai/app/controllers/generative_learning_controller.py`.

## Configuración

La clave real debe existir únicamente en `.env` local o el gestor de secretos del entorno.
No debe aparecer en `.env.example`, Git, logs, comandos CI ni documentación.

Variables:

```text
GEMINI_API_KEY
GEMINI_MODEL
GEMINI_TIMEOUT_SECONDS
GEMINI_MAX_RETRIES
GEMINI_MAX_INPUT_CHARS
GEMINI_MAX_QUESTIONS
GEMINI_MAX_REQUESTS_PER_MINUTE
GEMINI_MAX_REQUEST_BYTES
```

La clave no se publica como puerto ni se envía al navegador.

## Endpoints internos

### Clasificación

```text
POST /internal/v1/learning/classify-topics
```

### Evaluación

```text
POST /internal/v1/learning/generate-assessment
```

### Retroalimentación

```text
POST /internal/v1/learning/generate-feedback
```

Todos exigen `Authorization: Bearer <LEARNING_SERVICE_TOKEN>` y UUID canónicos.

## Seguridad

- Spring autoriza usuario, materia y documento.
- Flask valida límites y JSON.
- Gemini no recibe identidad, credenciales ni datos personales.
- Las respuestas no pueden contener HTML ni Markdown.
- No se ejecuta código generado.
- Los errores no exponen respuestas API ni claves.
- Las respuestas usan `Cache-Control: no-store`.

## Integración con ML

```text
Observaciones
  -> baseline/regresión logística
  -> temas débiles
  -> prompts Gemini
  -> actividad o retroalimentación
  -> Spring
```

Gemini no modifica calificaciones, permisos o resultados académicos.

## Pruebas

Las pruebas usan mocks y no requieren red:

- JSON válido.
- JSON inválido.
- HTML y Markdown.
- Timeout simulado.
- Respuesta vacía.
- Errores API normalizados.
- Límites de entrada y preguntas.
- Clasificación temática.
- Evaluación.
- Retroalimentación.

## Estado pendiente

- Taxonomía curricular oficial compartida con Spring.

## Estado implementado

- SDK oficial integrado.
- Cliente aislado y reutilizable.
- Prompts JSON robustos.
- Validadores de evaluación, feedback y temas.
- Endpoints internos Flask.
- Mocks y pruebas locales.
- Adaptador HTTP mínimo en Spring.
- Configuración Compose sin exponer GEMINI_API_KEY.

## Validación verificable

- Spring: pruebas de actividades aprobadas y despliegue saludable.
- Flask: pruebas Gemini y validadores aprobadas.
- Prueba directa: HTTP 200 con conteo exacto y opciones únicas.
- Fallback local: evaluación válida si Gemini responde mal o no está disponible.
- Flujo navegador: materia, documento READY, generación, respuesta e intento consultable.

## Próxima versión

- Modelo supervisado entrenado con datos reales autorizados.
- Integración completa de debilidades por tema.
- Asociación curricular persistida y taxonomía oficial.
- Validación pedagógica externa y auditoría de métricas.
- Políticas finales de retención, coste y cuota del proveedor.
