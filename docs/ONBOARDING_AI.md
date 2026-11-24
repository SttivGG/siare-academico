# Incorporación: aprendizaje adaptativo

Integrante 3. Carpeta `services/content-ai/`; futura rama `feature/ai-aprendizaje-adaptativo`, creada desde `main` actualizado según [colaboración](GUIA_COLABORACION.md). Esta guía prepara el desarrollo posterior; no entrega modelo ML ni endpoints nuevos.

## Base que debes conservar

Python 3.12, Flask, Gunicorn y dependencias fijadas en `requirements.lock`. `app/controllers/extraction_controller.py` recibe bytes desde Spring en `POST /internal/v1/extractions`; `app/models/extraction_model.py` limita ejecución y aísla el parser en un subproceso terminable. `app/models/extraction.py` extrae PDF, DOCX, PPTX e imágenes con OCR. `GET /health` comprueba MongoDB y Redis. `tests/test_extraction.py` y `tests/test_health.py` cubren esta base.

No cambies el contrato de extracción, sus límites, autorización, unidades de origen ni conservación del original en Spring. No modifiques Abstract Factory, `frontend/`, identidad, Flyway o infraestructura compartida. Acuerda cualquier necesidad de configuración con el líder. No envíes documentos, credenciales o datos personales a servicios externos para entrenar.

## Entorno y primera verificación

Lee [arquitectura](ARCHITECTURE.md), [Fase 2](PHASE2.md), [roles](EQUIPO_ROLES.md) y [contratos](CONTRATOS_EQUIPO.md). El arranque común y las precauciones para instalaciones existentes están en [onboarding móvil, arranque con Docker](ONBOARDING_MOBILE.md#arranque-con-docker); se reutilizan para los cuatro integrantes.

Desde la raíz, con Python 3.12 instalado:

```powershell
Push-Location services/content-ai
py -3.12 -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.lock
./.venv/Scripts/python.exe -m unittest discover -s tests -v
Pop-Location
```

El host omite OCR real salvo que se habilite expresamente y exista Tesseract español. Con la instalación Docker ya preparada:

```powershell
docker compose -f compose.datos.yml -f compose.apps.yml --env-file .env exec -T -e SIARE_REAL_OCR=1 content-ai python -m unittest discover -s tests -v
```

El servicio no publica puerto al host. Spring lo llama por `http://content-ai:5000` dentro de Docker y usa `CONTENT_SERVICE_TOKEN` para extracción. `LEARNING_SERVICE_TOKEN` es una credencial independiente para el futuro endpoint de aprendizaje y `LEARNING_MAX_BYTES` limita su carga JSON. Ambos se generan o conservan con `Initialize-Phase2.ps1`; no se reutiliza el secreto de extracción ni se envían al navegador. Consulta variables en `compose.apps.yml`, sin imprimir configuración expandida ni copiar `.env`. El token para el futuro contrato ML es una propuesta independiente, todavía sin aprovisionamiento.

## Plan de trabajo posterior

1. Acordar con el líder el contrato ML propuesto, identificadores de tema, procedencia de resultados y tratamiento de datos insuficientes. Crear fixtures sintéticas compartidas en las pruebas de cada módulo; no cambiar contratos de producción por cuenta propia.
2. Documentar dataset autorizado, etiquetas, objetivo, baseline y métrica antes del entrenamiento. Separar entrenamiento/validación/prueba por estudiante o tiempo para evitar fuga; fijar semilla y versiones. No usar rendimiento sobre entrenamiento como evaluación.
3. Implementar después el modelo y su API en el servicio existente, sin mezclar evaluación de quiz/crucigramas con recomendación. Versionar metadatos del modelo, transformación de variables y criterios de dificultad; conservar artefactos grandes y datos privados fuera de Git.
4. Medir concurrencia y paralelismo con cargas reproducibles: ejecución secuencial frente a workers acotados, duración, p50/p95, throughput, errores, CPU y memoria. Separar entrenamiento de peticiones; probar que extracción y salud siguen respondiendo durante la carga. Los threads de Gunicorn por sí solos no acreditan paralelismo ML.
5. Añadir pruebas de validación, autenticación interna, datos insuficientes, contrato, modelo/versionado, timeouts y saturación. Repetir regresiones de extracción; coordinar `scripts/Test-Phase2.ps1` con el líder cuando el stack esté listo.

## Evidencias para el PR

Incluye instrucciones reproducibles, versión del dataset sin datos privados, particiones, baseline frente a métrica elegida, versión del modelo y límites conocidos. Adjunta una tabla de mediciones con hardware, tamaño de carga y configuración; registra resultados reales y omisiones. Relaciona pruebas con [matriz](MATRIZ_REQUISITOS_EQUIPO.md). No presentes ejemplos sintéticos ni resultados previstos como un modelo evaluado.

El primer trabajo puede avanzar con fixtures antes de contar con eventos reales. La integración final requiere que Spring entregue resultados autorizados y que analytics acuerde su semántica; Python no consulta directamente las tablas de sesiones ni decide permisos.
