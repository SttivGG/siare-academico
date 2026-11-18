# H0: protección de Fase 2

Verificación realizada el 10/11/2026 (America/Bogota), sobre `feature/fase2-documentos`.
Se revisaron los 19 archivos modificados y 44 nuevos: configuración, scripts,
documentación, frontend, extracción Flask, puertos/adaptadores Java y pruebas.
No se encontraron bloqueos de código que impidan proteger esta fase.

`.env`, `.cache`, `.local`, claves PEM/KEY y artefactos de compilación están
excluidos de Git. La comparación de los 63 entregables con las contraseñas y el
token locales no encontró coincidencias; tampoco se encontraron claves privadas
PEM, claves AWS ni tokens GitHub. Los correos de pruebas usan `example.test` y
las contraseñas de fixtures son sintéticas. No se versionan datos de las bases.

| Verificación ejecutada | Resultado |
| --- | --- |
| Maven verify con JDK 21 portátil | 38 pruebas, cero fallos, BUILD SUCCESS |
| Flask unittest dentro del contenedor, SIARE_REAL_OCR=1; pip check | 13 pruebas, OCR español real; dependencias compatibles |
| Frontend npm test y typecheck | 12 pruebas y TypeScript correctos |
| Express npm test | Build y tres pruebas correctos |
| Test-Phase1.ps1 | 31 comprobaciones HTTP; esquema y BCrypt correctos |
| Test-Phase2.ps1, repetición aislada | 124 comprobaciones HTTP y verificación de salud correctas |
| Playwright con Chrome instalado | Seis pruebas correctas, escritorio y móvil, 28,8 s |
| Test-Siare.ps1 | Ocho servicios healthy, consultas reales a cuatro motores, solo puertos 3100 y 8180 en loopback |
| git diff --check | Correcto |

La primera ejecución documental tuvo ECONNRESET después de validar los seis
formatos mientras se ejecutaban otras comprobaciones. La repetición completa
aislada pasó; no se ocultó el error mediante reintentos automáticos de peticiones.
Playwright inicialmente no encontró su navegador descargable; se utilizó Chrome
ya instalado mediante PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH. Maven emitió un aviso
403 de metadatos opcionales OW2 y avisos Mockito; terminó correctamente.

Docker Engine 29.8.0 y Compose 5.5.1 estaban operativos. Los contenedores reales
son `siare-academico-{mysql,mongo,cassandra,redis,core-api,content-ai,progress-api,frontend}-1`.
Los volúmenes reales son `siare-academico_mysql-data`, `siare-academico_mongo-data`,
`siare-academico_mongo-config`, `siare-academico_cassandra-data`,
`siare-academico_redis-data` y `siare-academico_jwt-keys`.
Las redes son `siare-academico_data` (internal=true) y `siare-academico_edge`.
Se comprobaron sus etiquetas de proyecto/instancia y los montajes correspondientes.
No se modificaron recursos de otros proyectos ni se borraron volúmenes.

Evidencias locales ignoradas: `.cache/h0-java.log`, `.cache/h0-phase1.log`,
`.cache/h0-phase2.log`, `.cache/h0-phase2-retry.log`, `.cache/h0-browser-chrome.log`.
Las pruebas conservaron sus datos sintéticos. El hash del commit que incluye
esta verificación se registra posteriormente en el informe H1 para evitar
una referencia circular. No se autoriza ni se realiza push.
