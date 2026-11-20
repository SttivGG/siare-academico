# H6-5: revisión de interacciones antes de implementar

Base: `56687c678a3260a9f0ceaa24a8101986043de6b1`, PR #12 abierto y draft. Revisé los componentes H6-4, las 50 filas de la matriz, los informes H6-0 a H6-4, la política de recuperación y las capturas originales Nexo. La línea base se tomó en la imagen H6-4 activa, revisión `cc6cd704`, antes de recrear la preview de 3107.

| Prioridad | Hallazgo | Decisión H6-5 |
| --- | --- | --- |
| P1 | El menú de cuenta/tema/móvil permanece abierto cuando Tab lleva el foco al formulario. El menú móvil puede conservar foco en contenido que pasa a `display:none` al ensanchar la ventana. | Cerrar al salir el foco; preservar el recorrido nativo con Tab y Escape; restaurar a un activador visible en escritorio. Usar exclusividad nativa y conservar el fallback existente. |
| P1 | Abrir una actividad contrae el catálogo mientras el foco sigue en su botón oculto. | Enfocar el título del jugador tras la respuesta del servidor. Mantener una sola instancia y las claves existentes por actividad. |
| P1 | La consulta de intentos indica UUID inválidos con un error genérico, sin relacionarlo con cada entrada ni orientar el foco. | Asociar errores por campo, enfocar el primer ID inválido y conservar ambos valores. Bloquear consultas duplicadas durante pending. |
| P2 | El error de recuperación queda dentro del diálogo sin recibir el foco. El bloqueo de presentación depende de un render de `pending`. | Enfocar el aviso del diálogo y añadir un guard síncrono. Conservar cifrado, autorización, almacenamiento y reglas de descarte. |
| P2 | Los accesos de Estudio y los botones de panel no comparten una señal visual fuerte para `aria-pressed`. | Aplicar selección con tokens existentes, borde y contorno interior. Mantener foco independiente de selección y señal en forced colors. |
| P2 | El Quiz comunica avance con texto; las opciones se agrupan por un ID interno de pregunta. | Añadir progreso determinado de preguntas respondidas, nombre del grupo ligado a la pregunta y anuncio de pending/resultado autorizado. Conservar Anterior/Siguiente y su foco. |
| P2 | El crucigrama no conecta la celda enfocada con su pista ni distingue la palabra en curso. | Derivar la pista de celda/dirección, asociarla por `aria-describedby` y destacar pista y celdas con texto/contorno. Mantener flechas, Enter, Retroceso y el controlador. |
| P2 | Una búsqueda de fuentes sin coincidencias deja una lista vacía sin explicación; la selección se reconoce principalmente en el botón. | Añadir mensaje de filtro sin resultados y borde de fuente seleccionada. Mantener carga bajo demanda, cuarentena y disponibilidad READY. |
| P2 | El movimiento se concentra en dos colores de botones; menús y avisos aparecen abruptamente. | Usar ritmos existentes 140/220 ms y `--ease`, entrada/salida de desplegables y revelado breve de avisos/paneles. Habilitar movimiento solo con no-preference. |

No encontré animaciones CSS permanentes o shimmer que hubiera que eliminar. Los skeletons H6-4 ya eran estáticos. El foco visible y las confirmaciones nativas existentes se conservan. La paleta, Urbanist, rail, breadcrumbs y distribución A coinciden con la referencia aprobada; no requieren otro sistema visual.

Durante la validación de la implementación, una pulsación rápida de Tab reveló que una transición discreta de `content-visibility` podía retrasar la entrada al menú. La apertura hace visible el contenido de inmediato y anima únicamente opacidad; el cierre conserva la transición discreta progresiva. El cambio de breakpoint en el contexto móvil también requirió recordar el último foco, porque Chromium puede desenfocar el enlace antes de emitir el evento de media query.

La revisión de capturas detectó además el verde predeterminado de `<progress>` en Chromium. Los selectores de barra del motor aplican los tokens Nexo sobre el mismo elemento nativo, con colores del sistema en forced colors. Firefox/WebKit siguen pendientes de verificación real.

El registro final de pruebas, mediciones, límites y despliegue pertenece a [H6_5_INFORME.md](H6_5_INFORME.md). Esta auditoría no convierte las omisiones H6-4 en casos aprobados.
