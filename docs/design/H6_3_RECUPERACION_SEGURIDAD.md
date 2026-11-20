# H6-3: recuperación local y límites de seguridad

La conservación durante cambios de herramienta, panel, tema o resolución pertenece a `AcademicController`, bajo el layout privado estable. Su clave es usuario autenticado y materia; cada borrador pertenece a una fuente o a `external`, y cada intento a una actividad. React conserva una sola vista del jugador. Cambiar de actividad recupera su intento propio.

## Consentimiento y custodia

La copia local está deshabilitada inicialmente. El estudiante puede continuar en memoria, con un aviso sobre recarga y cierre, o habilitar IndexedDB con consentimiento y una frase local de 12–512 caracteres distinta de su contraseña SIARE. La interfaz solicita la frase al habilitar o recuperar. No la solicita al cambiar herramientas.

Web Crypto deriva una clave AES-GCM de 256 bits mediante PBKDF2-HMAC-SHA-256, 600 000 iteraciones y una sal aleatoria independiente de 16 bytes. La clave no es extraíble. Cada escritura usa un IV aleatorio nuevo de 12 bytes y un tag de 128 bits. El navegador mantiene frase y clave únicamente en memoria; la frase se retira del formulario tras éxito o cancelación. Ningún token o secreto SIARE participa en la derivación.

Los parámetros son una decisión de esta implementación, verificada con las APIs estándar. Las referencias técnicas son [SubtleCrypto.deriveKey](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey) y [AesGcmParams](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams). No se utilizan algoritmos experimentales ni la guía volátil `tmp-webcrypto-modern-algos`.

## Esquema permitido, versión 1

`academic-recovery.ts` construye el snapshot campo por campo. Incluye configuración y JSON manual, revisión y huella de fuente, selección, respuestas/celdas, dirección, índice, inicio y sobre pendiente. El JSON manual contiene soluciones privadas del autor y se cifra con el resto del trabajo. No se serializan objetos API completos.

Quedan fuera los originales, fragmentos documentales, cookies, JWT, refresh tokens, claves, contraseñas SIARE, códigos/semillas MFA, tokens OIDC/reset, contenido del jugador y respuestas esperadas o explicaciones de evaluaciones. Tras confirmar un envío se retiran sus respuestas y sobre de la copia; solo se conserva el ID del resultado. Restaurarlo exige volver a consultar ese resultado autorizado en Spring.

El registro y los datos autenticados AES-GCM vinculan versión, usuario, materia, IDs de fuentes y actividades, consentimiento, sal, parámetros y fechas. La actividad vuelve a obtenerse de Spring y mantiene su procedencia propia. La fuente seleccionada no reescribe la procedencia de una actividad.

El límite de la copia es 8 MiB. La lectura valida tipos, IDs, tamaños, opciones y celdas contra el contrato actual. Las versiones incompatibles producen un error y una opción de descarte; no se migran ni sobrescriben silenciosamente.

## Autenticación, caducidad y concurrencia

Antes de restaurar se comprueban `/users/me`, la materia, las fuentes READY actuales y cada actividad; los resultados confirmados requieren además su consulta autorizada. La aplicación rechaza restaurar la copia a una cuenta diferente aunque conozca su frase. Quien posea la frase y extraiga el registro puede descifrarlo fuera de la aplicación; la comprobación de cuenta no cambia esa propiedad del cifrado local. Al recuperar se conserva el trabajo en memoria hasta verificar y reclamar la copia completa.

La caducidad máxima es siete días desde la última edición académica. `editedAt` se conserva al restaurar. Cambiar de panel, releer o reescribir el mismo snapshot no renueva ese plazo. La entrada a la aplicación privada y la búsqueda de copias purgan registros caducados. No se promete eliminación física con el navegador cerrado, ni borrado seguro del disco del dispositivo.

Las escrituras se serializan y solo anuncian “guardada” después de `transaction.oncomplete`. Web Locks mantiene un único editor de la copia por usuario/materia y libera el bloqueo al cerrar o recargar la página. La transacción compara también la revisión del registro. Si Web Locks falta, revisión y lease de 30 segundos evitan sobrescrituras; una recuperación inmediata puede requerir esperar a que caduque el lease. Esa alternativa conserva la memoria y comunica el conflicto.

El cierre de sesión de la interfaz elimina las copias de esa cuenta y las referencias a claves, y comunica el cierre a otras pestañas mediante BroadcastChannel. La expiración bloquea el estado y permite recuperar la copia vigente al reautenticar como el mismo usuario. Al recuperar el foco se comprueba si cambió la cuenta. Ninguno de estos controles modifica roles, credenciales ni autorización del servidor.

Un descarte explícito elimina la copia de la materia para ese usuario. Otra pestaña que conserve una revisión antigua detectará el conflicto en su siguiente escritura y mantendrá sus datos en memoria. El aviso de guardado corresponde a la escritura confirmada de esta pestaña, no a una garantía de retención frente al borrado explícito desde otro contexto.

## Envíos H3

El controlador crea una sola vez `idempotencyKey`, `answers` y `durationMs` antes de cualquier espera. El estado `sending` bloquea de forma síncrona el doble clic. Un error conserva el sobre como `unresolved`; el jugador permanece bloqueado y ofrece un reintento explícito.

Con recuperación habilitada, el sobre se escribe y confirma antes del POST. Si esa escritura falla, el POST no se ejecuta: el estudiante puede reintentar el almacenamiento o continuar solo en memoria y reintentar el mismo envío. Recargar, montar una vista o volver a una herramienta no envía respuestas.

Una respuesta tardía actualiza únicamente el intento original y se comprueba su clave antes de aplicarla. La recuperación no puede sustituir un intento en memoria que siga enviándose o sin resolver; primero debe resolverse ese envío. Un resultado confirmado se consulta otra vez al recuperar, sin guardar el solucionario del servidor en IndexedDB.

## Fallos y alcance

Frase incorrecta, ciphertext alterado, versión antigua, cuota, almacenamiento bloqueado, falta de propiedad o conflicto entre pestañas conservan el trabajo actual. La interfaz permite cancelar, reintentar, continuar en memoria o descartar expresamente la copia. Un error de disco no borra borradores ni genera una nueva clave de idempotencia.

Este cifrado limita la exposición del contenido almacenado. No protege frente a XSS o código malicioso que ejecute en el mismo origen, ni proporciona sincronización entre dispositivos. La interfaz comunica ambos límites. No se presenta esta revisión como una auditoría de seguridad completa.

Las pruebas ejecutables y sus resultados figuran en [H6_3_INFORME.md](H6_3_INFORME.md). Firefox/WebKit, lector de pantalla, zoom real y teclado virtual físico requieren validación adicional; Chromium emulado no los acredita.
