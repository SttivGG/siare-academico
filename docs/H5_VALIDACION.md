# Validación de H5-A

19/11/2026, America/Bogota. Esta entrega añade diseño, contratos, fixtures
sintéticas y un verificador offline. No implementa generación ML ni endpoints
Spring, Python o Next.js. El acuerdo con el responsable ML sigue pendiente.
El usuario confirmó el 19/11/2026 que todavía no hay respuesta del responsable;
se incorporó esa confirmación al diagnóstico y al registro de acuerdo.

## Revisión de dependencias

GitHub se consultó en modo de lectura: #6 y #7 abiertos, no fusionados y
fusionables individualmente contra main `6c3a742abd7c344c1810af699ba4ff10d0678c35`.
Sus HEAD fueron `acba2808ad0908ff05d6852cedb6eba5cb281171` y
`1e8658ed555c952991bff85c9bb2b5dd8ee4a5e1`. El conector devolvió listas vacías
de revisiones, estados y workflows de PR; no se presenta CI aprobado.

Se leyó la propuesta H4 desde su HEAD y los contratos/onboarding AI desde
`da02404200edb54bf1584f78c3253814c6544a9e`. Las ausencias y desfases del checkout
están documentados en [el diagnóstico H5](H5_INTEGRACION_DOCUMENTOS.md).
La integración local `697621ee8a6a450c551bbf6f13ffda6fc2beab18` permaneció limpia.

## Pruebas ejecutadas

Python 3.12.0; dependencias aisladas de prueba fijadas en
`scripts/contracts/requirements.txt`. No se instalaron en `services/content-ai/`.

```powershell
.cache/h5-contract-venv/Scripts/python.exe -m unittest discover -s scripts/contracts -p 'test_*.py' -v
.cache/h5-contract-venv/Scripts/python.exe -m pip check
```

| Comprobación | Resultado |
| --- | --- |
| Suite compartida de contrato | 24 tests, 0 fallos/errores; última ejecución 0,382 s |
| JSON Schema 2020-12 y definiciones | Válidos para Draft202012Validator |
| Ejemplos internos QUIZ/CROSSWORD | Pasan estructura y reglas cruzadas |
| Contenido no respaldado | Rechaza cita falsa, fragmento ajeno, unidad errónea, respuesta ausente y respuesta normalizada vacía |
| Límites y normalización | UTF-8 por bytes, UTF-16 de Java, profundidad JSON, NaN/infinito, claves JSON duplicadas, conteos, opciones y Ñ comprobados |
| Borradores y revisión | Rechaza validated:true del generador, confirmación ausente/false, revisión ausente y campos autoritativos del cliente |
| Errores sintéticos | Insuficiencia, OCR, ambigüedad, saturación, indisponibilidad y timeout usan el contrato previsto |
| Compatibilidad de mapeo H3 | Ejemplos revisados pasan el esquema ActivityCreate vigente; el DTO draft sin convertir es rechazado |
| OpenAPI propuesto | Referencias y archivos de ejemplos se resuelven offline; no se añadió H5 al OpenAPI de producción |
| CLI del verificador | El par Quiz válido devuelve PASS y exit 0 |
| Dependencias de pruebas | `pip check`: sin dependencias rotas |
| Diff de archivos existentes | `git diff --check`: correcto; sin diferencias nuevas en servicios, Compose ni OpenAPI de producción |

La instalación inicial con pip encontró un problema de certificados en su cadena
TLS. Se descargaron wheels desde PyPI usando HTTPS nativo de Windows, se comparó
cada SHA-256 con la metadata de PyPI y se instalaron offline en el entorno aislado.
No se deshabilitó la verificación TLS. Wheels y entorno permanecen en `.cache/`,
fuera de los entregables y dependencias de producción.

Estos tests no ejecutan HTTP real, Java, Abstract Factory, almacenamiento,
sesiones/CSRF o un modelo. Las fixtures de OCR/ambigüedad no prueban capacidad de
detección de ML. La matriz de integración y aceptación posterior está en el
diagnóstico; no se atribuyen a esta tarea los recorridos H4 históricos.

## Verificación de la instalación habitual

Rama de trabajo: `fix/document-compatibility-isolation`.
HEAD: `acba2808ad0908ff05d6852cedb6eba5cb281171`. Entregables nuevos sin commit;
sin push, fusión de PR ni cambio de main.

Se inspeccionó el proyecto Compose `siare-academico`, sus archivos oficiales y
el override H4 congelado. Los IDs e imágenes de aplicaciones están en
[el diagnóstico](H5_INTEGRACION_DOCUMENTOS.md#base-ejecutada-comprobada-en-solo-lectura).
Los nueve contenedores conservaron sus IDs entre las dos lecturas de esta tarea:

| Servicio | Contenedor | Estado final |
| --- | --- | --- |
| frontend | eae9ae80e3c1 | healthy |
| core-api | 27138d454210 | healthy |
| content-ai | 8a7f97dc46a9 | healthy |
| progress-api | c5ee706867eb | healthy |
| mysql | a874a4f0ab46 | healthy |
| mongo | c11e8984ca8b | healthy |
| cassandra | 274b64b24986 | healthy |
| redis | d7b516acd286 | healthy |
| clickhouse | f93db5993ddb | healthy |

La lectura final confirmó HTTP 200 en `http://127.0.0.1:3100/`, el indicador
`Spring disponible`, frontend UP en `/api/health` y core UP en
`http://127.0.0.1:8180/health`. No se abrió navegador porque no cambió la interfaz.
Se confirmó que existe `siare-academico-frontend:pre-h4-20261119`, imagen
`sha256:fcf1dcfef4b24fc51ac886e48d5a81f2a19e15a9aba81da47895d20e2033b950`.

Esta entrega no afecta código de los contextos de build ni servicios activos;
por ello no requirió build ni recreación. Los scripts añadidos solo verifican
contratos fuera de producción. Se conservaron los cambios locales anteriores y
no se ejecutaron mutaciones sobre datos, volúmenes, redes, credenciales o claves.
La salud observada no certifica ausencia de errores internos de ClickHouse ni
revalida MFA/OIDC de extremo a extremo.
