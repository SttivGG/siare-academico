# H6-7C: validación del candidato ligero

Recomendación: **MERGE NO-GO**. La comprobación actual de Docker y
de los puertos habituales no acredita un entorno sano. No se modifica ese entorno
para resolver la incidencia. Los resultados anteriores de H6-7A son históricos;
la presente preparación vuelve a ejecutar las pruebas aisladas.

| Control | Resultado actual |
| --- | --- |
| Base main | `c8f934492f0cc7809282657270df34b4474915ca`, contrastada con GitHub |
| Frontend inicial y final | `d7c0ff7905bbacb98c82664ca0568bb5afafc8e0`, sin limpieza posterior del código |
| TypeScript | PASS |
| Build producción | PASS; 15 páginas, cinco handlers y página técnica de error |
| Unitarias/componentes | 50 PASS, cero omisiones |
| BFF actividades | 4 PASS, upstream HTTP en memoria |
| BFF identidad/OIDC | 8 PASS, upstream HTTP en memoria |
| Estados internos/roles de interfaz | 5 PASS, Next y Chromium con upstream controlado |
| Playwright release completo | 125 PASS, cero fallos/flaky, cinco omisiones preexistentes; 8,7 minutos |
| Casos de aceptación | 58 filas conservadas, con referencias a pruebas ejecutables |
| Auditoría de archivos | CSV por archivo canónico y por grupo local; manifiesto físico privado |
| Despliegue | No ejecutado por restricción expresa del usuario |
| Salud 3100 | Timeout HTTP en comprobación actual |
| Salud 3107 | Conexión rechazada en comprobación actual |
| Inventario Docker activo | CLI agota 15 segundos; no se acreditan imágenes ni contenedores actuales |

La primera invocación de Playwright dentro del sandbox perdió el ejecutor sin
producir un resumen. Se conservaron sus salidas incompletas en `.cache/` y se
cerraron exclusivamente los dos procesos de fixture creados por esa invocación.
La ejecución válida usa Chromium con permiso de procesos y el mismo código,
configuración, escenarios y aserciones. Esa incidencia no se registra como
regresión del producto ni se oculta como un PASS.

Los scripts de integración y `playwright.release.config.ts` arrancan Next
compilado con un proveedor HTTP de loopback y datos en memoria. El servidor
release solo acepta 3137/3138 y no tiene fallback al core habitual. No se
ejecutan scripts autenticados contra 3100/3107 ni pruebas backend con almacenes
reales. Los tres PDF sintéticos se copian desde fixtures versionadas.

Cinco omisiones preexistentes corresponden a repeticiones móviles de matrices
que ya incluyen tamaños móviles; el código de pruebas permanece idéntico.
No equivalen a cinco funciones excluidas de la validación. Las regresiones
ST-01 a ST-10 siguen en unitarias, Cuaderno, recuperación y Apariencia.

OIDC externo, SMTP, autorización/TOTP/extracción/evaluación/persistencia reales
de Spring, Firefox/WebKit y comprobaciones manuales siguen teniendo los
[límites explícitos de H6](H6_KNOWN_LIMITATIONS.md).

El [resumen verificable](H6_VALIDATION_SUMMARY.json) registra los resultados,
hashes de logs locales y observación final con navegador. Chromium confirmó
timeout en 3100 y conexión rechazada en 3107. El contexto oficial `desktop-linux`
también agotó doce segundos al consultar contenedores: no era un contexto alternativo
seleccionado por error. El estado NO-GO se mantiene mientras no exista evidencia
actual de salud y de preservación del runtime.
