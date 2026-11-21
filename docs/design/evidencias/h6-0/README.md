# Evidencias H6-0

Capturas de la instalación habitual en `http://127.0.0.1:3100`, tomadas el 19 de noviembre de 2026, America/Bogota. `capturedAt` en JSON usa UTC, por eso registra 20 de noviembre. Rama de entrega `feat/h6-design-audit`; base `c8f9344`; frontend activo `697621e`. La auditoría no desplegó cambios.

## Resultados legibles por máquina

- [mediciones.json](mediciones.json): Chromium efectivo, 32 capturas de la primera pasada, ocho resoluciones, geometría de paneles, pérdidas de estado y comprobaciones de salud/cookies.
- [comprobaciones-adicionales.json](comprobaciones-adicionales.json): forma real del catálogo sin fecha, 15 focos de teclado, ausencia de visor original y cancelación de archivo. La segunda pasada añadió dos capturas y reemplazó login-1440 por el formulario tras terminar la carga de proveedores.
- [instalacion.json](instalacion.json): nueve contenedores, imágenes y health. No incluye entornos ni secretos.
- [cierre-salud.json](cierre-salud.json): verificador oficial terminado con código 0 y comparación final; los nueve contenedores mantienen ID, imagen y estado healthy.
- [skills-origen.json](skills-origen.json): hashes de los tres SKILL.md leídos, sin modificarlos.
- [referencias-origen.json](referencias-origen.json): archivos originales Nexo/NotebookLM y hashes; el contenido de referencia se consultó en modo lectura.
- [manifest.sha256](manifest.sha256): integridad de los archivos de esta carpeta, excluyéndose a sí mismo.

## Capturas SIARE

| Grupo | Archivos |
| --- | --- |
| Acceso público | `bienvenida-1440.png`, `login-1440.png`, `registro-1440.png`, `recuperar-1440.png`, `login-390.png` |
| Pantallas privadas | `inicio-1440.png`, `materias-1440.png`, `materias-390.png`, `nueva-materia-1440.png`, `seguridad-1440.png`, `seguridad-390.png`, `sesiones-1440.png`, `administracion-user-1440.png` |
| Workspace y fuentes | `workspace-vacio-1440.png`, `documento-cuarentena-1440.png`, `texto-documental-1440.png`, `confirmar-archivo-1440.png`, `workspace-390.png` |
| Matriz de layout, capturas de viewport | `workspace-1920x1080.png`, `workspace-1440x900.png`, `workspace-1366x768.png`, `workspace-1024x768.png`, `workspace-768x1024.png`, `workspace-390x844.png`, `workspace-375x812.png`, `workspace-320x812.png` |
| Herramientas y resultados | `banco-1440.png`, `quiz-1440.png`, `crucigrama-1440.png`, `intentos-1440.png`, `evaluacion-spring-1440.png` |
| Preferencias y foco | `preferencia-oscura-1440.png`, `foco-teclado-1440.png`, `texto-200-1440.png` |

`preferencia-oscura-1440` muestra la interfaz actual bajo preferencia de sistema oscura; SIARE conserva sus colores claros. `texto-200-1440` aumenta el tamaño raíz de texto mediante CSS: no demuestra zoom real de navegador. Las capturas largas usan página completa; la matriz usa viewport. El navegador se redimensionó con locale es-CO, zona America/Bogota y movimiento reducido; no acredita teléfono físico ni emulación de teclado virtual.

Los datos de estas capturas son de la cuenta sintética de auditoría. El porcentaje de `evaluacion-spring-1440` es un resultado real calculado por Spring para un intento de prueba; no es una métrica agregada ni rendimiento de un estudiante. No hay respuestas HTTP simuladas. El catálogo muestra un defecto real `Invalid Date`, documentado como UX-06, y no se retocó la imagen para ocultarlo.

## Referencias originales

Se conservaron sin redibujar cuatro capturas del repositorio Facturación Hexagonal: `nexo-claro-original.png`, `nexo-oscuro-original.png`, `nexo-formulario-original.png` y `nexo-movil-original.png`. La captura oscura incluye datos financieros de demostración del proyecto original, ajenos a SIARE.

Las capturas NotebookLM corresponden, por orden, a `Captura de pantalla 2026-11-18 183847.png`, `Captura de pantalla 2026-11-18 184837.png` y `Captura de pantalla 2026-11-19 123101.png`, en la carpeta NBML indicada por el usuario. Sus copias son `notebooklm-original-1.png` a `notebooklm-original-3.png`. Muestran cuaderno vacío de escritorio oscuro; no acreditan flujo móvil ni fuentes cargadas.

Estas imágenes se conservan como referencias de revisión del proyecto. No son recursos del frontend ni se publicaron en un sitio. Urbanist ya se distribuye en SIARE con su licencia OFL; no se añadieron fuentes, iconos ni fotografías al runtime.

## Reproducción de las observaciones principales

1. Abrir una materia con Quiz. En Preparar banco escribir un tema; cambiar a Catálogo y volver. El tema desaparece (UX-01).
2. En Catálogo abrir Quiz y marcar una respuesta; cambiar a Preparar banco y regresar. La respuesta desaparece (UX-02).
3. Inspeccionar `GET /api/bff/subjects/{id}/activities` autorizado. Los resúmenes no incluyen `createdAt`; el catálogo intenta mostrar una fecha (UX-06).
4. Redimensionar la materia a los ocho viewports del JSON y medir `.document-panel`, `.learning-panel`, `.activities-panel` con `getBoundingClientRect`. En móvil están apilados, sin mecanismo de un panel por vez.
5. Activar preferencia oscura del navegador; texto y superficie del workspace permanecen claros. Usar Tab para observar el enlace de salto y el foco nativo.

Los scripts temporales de captura y credenciales quedan en `.cache/h6-audit/` del checkout habitual, ignorados por Git. Los entregables son documentación y evidencias; no requieren ejecutar esos scripts. La auditoría no reemplaza las pruebas completas de H6-6.
