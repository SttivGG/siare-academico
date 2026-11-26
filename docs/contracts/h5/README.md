# Fixtures y pruebas del contrato H5

Contrato v1 propuesto, pendiente de acuerdo ML. Ningún archivo de esta carpeta
implementa el generador, instala rutas ni certifica calidad académica.

## Uso local

Desde la raíz, con Python 3.12, crear un entorno separado de `services/content-ai`:

```powershell
python -m venv .cache/h5-contract-venv
.cache/h5-contract-venv/Scripts/python.exe -m pip install -r scripts/contracts/requirements.txt
.cache/h5-contract-venv/Scripts/python.exe -m unittest discover -s scripts/contracts -p 'test_*.py' -v
```

En Linux, usar `.cache/h5-contract-venv/bin/python` para los dos últimos comandos.
Los tests no necesitan Docker, servicio ML, bases ni credenciales. Tras instalar
las dependencias no acceden a la red; referencias JSON Schema se resuelven en
memoria. Los ejemplos OpenAPI usan referencias relativas a archivos compartidos.

Para comprobar un par de archivos producido por el consumidor o el productor:

```powershell
.cache/h5-contract-venv/Scripts/python.exe scripts/contracts/h5_contract.py --request docs/contracts/h5/fixtures/quiz-request.json --response docs/contracts/h5/fixtures/quiz-response.json --request-id 00000000-0000-4000-8000-000000000001
```

Para un error, añadir `--status 422`; para 429/503, también `--retry-after 5`.
El comando devuelve código 0 al pasar y 1 al rechazar. Solo imprime el código
de regla fallida, sin valores de documentos o respuestas.

## Archivos y cobertura

| Archivo | Uso |
| --- | --- |
| [activity-draft.schema.json](activity-draft.schema.json) | Definiciones request/response/error y entradas públicas previstas; objetos cerrados |
| [openapi.proposed.json](openapi.proposed.json) | Endpoint interno separado de OpenAPI de producción |
| [quiz-request.json](fixtures/quiz-request.json), [quiz-response.json](fixtures/quiz-response.json) | Una pregunta con fuente literal y explicación |
| [crossword-request.json](fixtures/crossword-request.json), [crossword-response.json](fixtures/crossword-response.json) | Dos palabras sustentadas; no promete que Python construya cuadrícula |
| [insufficient-response.json](fixtures/insufficient-response.json) | Rechazo de contenido insuficiente sin banco parcial |
| [ocr-response.json](fixtures/ocr-response.json), [ambiguous-response.json](fixtures/ambiguous-response.json) | Fallos de calidad explícitos |
| [public-request.json](fixtures/public-request.json), [publish-request.json](fixtures/publish-request.json) | Selección sin texto libre y confirmación con revisión |
| [public-response.json](fixtures/public-response.json) | Borrador privado; calidad ML vinculada a su revisión inicial |
| [reviewed-quiz-h3-request.json](fixtures/reviewed-quiz-h3-request.json), [reviewed-crossword-h3-request.json](fixtures/reviewed-crossword-h3-request.json) | Mapeo de ejemplo tras revisión sintética; compatibles con el esquema ActivityCreate H3 |
| [h5_contract.py](../../../scripts/contracts/h5_contract.py) | Oráculo de conformidad offline; no se importa en producción |
| [test_activity_draft.py](../../../scripts/contracts/test_activity_draft.py) | Casos positivos y mutaciones negativas de límites, evidencia y revisión |

La suite comprueba formato estricto, bytes UTF-8, longitudes Java UTF-16,
correlación, ecos, familia/count, fuentes seleccionadas, citas literales, presencia
normalizada de respuesta, duplicados, Ñ, advertencias y confirmación obligatoria.
También valida los ejemplos revisados frente a OpenAPI H3 y rechaza usar el draft
sin convertir como su banco; no invoca constructores Java ni Abstract Factory.
Los errores sintéticos de OCR/ambigüedad prueban el contrato de rechazo; no
demuestran que un modelo real detecte esos casos.

Cada equipo puede usar las fixtures sin ejecutar código ajeno: el productor Python
debe validar sus salidas y el consumidor Spring deserializar estas entradas en su
DTO draft y rechazar las mismas mutaciones. No copiar el DTO a ActivityBank hasta
confirmación humana. Una prueba HTTP del adaptador Spring deberá reproducir tanto
fixtures correctas como respuestas defectuosas de un servidor simulado.

Quedan para integración real la autenticación, headers HTTP, timeouts/cancelación,
publicación transaccional, sesiones/CSRF, idempotencia, cuotas, caducidad, permisos
y navegador. Los casos y las puertas de despliegue están en
[H5_INTEGRACION_DOCUMENTOS.md](../../H5_INTEGRACION_DOCUMENTOS.md).
