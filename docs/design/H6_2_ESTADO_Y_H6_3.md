# Estado académico y trabajo para H6-3

H6-2 establece los tokens y las composiciones globales; no acredita recuperación académica durable. El workspace muestra esta limitación antes de editar. No se guarda trabajo académico, identidad, JWT ni credenciales en localStorage/sessionStorage/IndexedDB. La única entrada añadida es `siare-theme`, con el enum light/dark; Sistema elimina esa entrada.

## Propietarios reales y garantías actuales

| Propietario | Estado conservado | Límite |
| --- | --- | --- |
| SubjectWorkspace | Materia, fuente única seleccionada, actividad reciente y evaluación consultada | Vive hasta abandonar la página de la materia. No es un almacén durable. |
| SubjectDocuments | Lista, carga, progreso, lectura y peticiones documentales | H6-2 conserva una sola instancia. Tema, menú y CSS responsive no cambian su identidad. |
| ActivityPanel | Catálogo/cursor, actividad abierta, consulta de intento y unconfirmed | `tab` sigue desmontando editor/jugador. H6-3 debe separar presentación y estado. |
| ActivityBankEditor | JSON, tema, tipo, cantidad, cuadrícula, banco validado y revisión | Se pierde al cambiar de herramienta. No sustituirlo por dos editores para móvil/escritorio. |
| ActivityPlayer / CrosswordGrid | Respuestas, índice, celdas, dirección, inicio y sobre congelado | Se pierde al desmontar el jugador. La clave por activityId es deliberada; no agregar keys de tema/panel/ancho. |
| StudentNav / ThemeControl | Menús, operación de logout y preferencia visual | Sin estado académico. El contenido se recibe una sola vez desde AppShell. La identidad/autorización permanecen en servidor. |

Pasó en navegador la conservación del banco abierto al alternar tema y 1440/1024/390/320 px, y al abrir/cancelar el diálogo de archivo. Cancelar y Escape no envían PATCH y restauran el foco. No se reutilizan estos resultados para declarar corregido el cambio Banco/Catálogo/Banco.

El jugador existente congela respuestas, duración y clave en una referencia antes del envío; el bloqueo síncrono evita doble envío. H6-2 no cambia ese algoritmo ni las cinco operaciones BFF. Las pruebas H4 vuelven a enviar el mismo JSON después de que Spring guarde y se simule pérdida de respuesta. Esto acredita el recorrido actual con jugador montado, no recuperación después de recargar o cambiar actividad.

## Bloqueantes de despliegue habitual

1. Elevar borradores por fuente y sesiones de actividad a un controlador estable por usuario/materia/actividad. Conservar revisiones y sobres pendientes; invalidar revisión al editar contenido/procedencia sin destruir otro borrador. Resolver respuesta tardía contra su actividad original.
2. Conectar los slots Fuentes/Aprendizaje/Estudio de `WorkspaceColumns` a ese controlador. Llevar lectura, banco, Quiz, Crucigrama y consulta al centro; la actividad aún se ejecuta en el panel heredado. La estructura A está preparada, no integrada. La navegación móvil global es un desplegable; la barra inferior académica solo se renderizará al integrar los slots.
3. Eliminar `createdAt` del resumen real de catálogo y sus dos usos visuales. Actualmente puede mostrarse Invalid Date después de abrir/crear una actividad. No inventar fecha alternativa.
4. Implementar y probar recuperación tras recarga. `beforeunload` y React en memoria no equivalen a persistencia; perder el proceso o navegar fuera de la materia puede perder trabajo.

## Recuperación propuesta y garantías pendientes

La política de H6_ESTRATEGIA_IMPLEMENTACION.md sigue siendo una propuesta: consentimiento explícito, copia permitida y versionada en IndexedDB, AES-GCM con IV nuevo y clave derivada por PBKDF2 de una frase local independiente. No guardar frase/clave junto al contenido, ni derivar claves de JWT o de la contraseña SIARE. No se implementó criptografía nueva en H6-2.

La recuperación requerirá sesión válida, desbloqueo y comprobación de propiedad actual en servidor. El registro y sus datos autenticados deben vincular usuario/materia/fuente/actividad/versión. Debe excluir tokens, semillas/códigos MFA, originales y solucionarios/feedback privados. Siete días es el máximo propuesto desde la última edición; la purga solo puede ejecutarse cuando la aplicación corre. No prometer eliminación física con navegador cerrado.

La escritura del sobre deberá confirmarse antes de anunciar que es recuperable; el reintento será explícito y conservará cuerpo, duración y clave. Probar cuota, bloqueo de almacenamiento, copia corrupta, frase incorrecta, recarga, cuenta A/B, logout, expiración y respuesta tardía. Web Crypto no protege de código malicioso que ya corre en el origen. La política completa debe quedar revisada e implementada en H6-3; no se considera segura una copia cifrada con clave almacenada al lado.

## Pruebas preparadas y cobertura posterior

`nexo-recovery.pending.spec.ts` conserva el recorrido ST-01 con sus aserciones y está marcado fixme: es una prueba pendiente, no aprobada. `nexo.spec.ts` cubre las transiciones de presentación autorizadas. H6-3 debe añadir ST-02–ST-10 de H6_1_RIESGOS_Y_REGRESIONES.md sobre el controlador real: revisión por fuente, Quiz/Crucigrama entre herramientas, envío congelado con cambio de panel y respuesta perdida, doble clic, navegación cancelada, recuperación y aislamiento A/B.

H6-4/H6-5 completarán los grupos y estados pendientes de la matriz: administración ADMIN/SUPERADMIN por ámbito y conflictos, identidades sensibles, cierre de sesiones con confirmación y todos los avisos/cargas. No elevar roles existentes para capturar. SMTP externo, OIDC externo, Firefox/WebKit, lector de pantalla, zoom real 200 % y teclado virtual físico conservan verificaciones separadas.
