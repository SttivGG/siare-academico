# H6 — Limpieza, revisión de privacidad y fronteras

## Clasificación previa a eliminación

| Hallazgo | Clasificación | Acción y justificación |
| --- | --- | --- |
| `frontend/src/components/layout/public-shell.tsx` | Código sin uso | Eliminado: ninguna importación/uso en fuente ni pruebas; landing usa `landing-access` y su módulo propio |
| `.publicShell`, `.publicHeader`, `.publicFooter` y variantes móviles en `shells.module.css` | CSS exclusivo de ese componente | Eliminadas siete reglas; retirado solo ese selector de la regla compartida de blur; AuthShell conserva su filtro |
| Imports de Link, ReactNode, ThemeControl de PublicShell | Imports del módulo retirado | Eliminados con el archivo; no se modifica un consumidor activo |
| 109 grupos de archivos con hash idéntico en el inventario inicial | Evidencias históricas, fixtures y recursos con contexto | Conservados: muchas capturas before/after idénticas acreditan preservación de 3100; no son duplicados prescindibles por igualdad de bytes |
| Logo original y logo limpio | Recurso histórico y recurso activo | Conservados ambos; el activo es `siare-logo-clean.png` |
| Cinco fondos y cinco miniaturas, Sin imagen | Recursos activos | Conservados, junto a `H6_APARIENCIA_RECURSOS.md`, autores y licencia Pexels |
| `docs/design/h6-1/` y capturas de alternativas | Prototipos/evidencia histórica | Conservados; no son imports del producto ni motivo para reescribir historia |
| `.cache/`, `.local/`, node_modules, salidas de navegador y scripts locales de despliegue | Estado local ignorado | Excluidos de la publicación; no se borran archivos ajenos |
| Tokens Sorvo, controladores académicos, fixtures y contratos | Código o evidencia utilizados | Conservados; pruebas de continuidad ST-01–ST-10 y suites existentes |

No se ejecutó limpieza global de Git/Docker, eliminación de worktrees ni reescritura de historia. El manifiesto de todos los archivos y el diff íntegro se revisan localmente, incluyendo recursos binarios por hash y su procedencia.

## Privacidad y secretos

Gitleaks 8.30.1 revisa el rango `origin/main..HEAD` y una copia de archivos rastreados con las modificaciones candidatas; no se incluye `.env`, claves privadas ni estado local. Se conserva el resultado bruto redactado localmente. Los cinco avisos `generic-api-key` iniciales apuntan a `docs/design/evidencias/h6-2/fuente-runtime.json`, líneas 44, 48, 55, 71 y 81. Los valores son hashes SHA-256 de `auth-form.tsx`, `auth-shell.tsx`, `password-recovery-form.tsx`, `api.ts` y `tokens.css`, verificados recalculando los bytes de Git del commit que identifica ese inventario. No son tokens de autenticación. No se añade una exclusión global para ocultar futuros hallazgos.

La inspección de rutas rastreadas, fixtures, diagnósticos y evidencias distingue datos sintéticos de credenciales privadas. Los informes nuevos no contienen contraseñas, códigos MFA, frases de recuperación de usuarios, cookies o respuestas de proveedores. Las capturas nuevas publicables se limitan a contexto sintético o páginas públicas y excluyen valores de autenticación. La revisión de privacidad visual es acotada; no se afirma OCR exhaustivo de las imágenes históricas.

Si aparece una credencial real: detener publicación, notificar al responsable por un canal privado, revocar/rotar el secreto del proveedor y revisar uso y exposición. Retirar el material en un commit posterior no lo elimina del historial. La corrección histórica requeriría un plan separado y autorización; nunca publicar el valor en el informe ni cambiar credenciales productivas unilateralmente.

## Seguridad de la corrección

Entrada menos confiable: parámetros de retorno y cabeceras Host/Forwarded del cliente; salida protegida: destino del navegador y cookies de SIARE. Los redireccionamientos internos usan destinos fijos relativos; los datos del proveedor no eligen un origen de retorno. Los callbacks externos siguen una allowlist de proveedor HTTPS y una comparación exacta de callback configurado, con rechazo de duplicados.

Las integraciones controladas comprueban rechazo CSRF, allowlist de campos, contexto de navegador, MFA sin sesión prematura, vinculación confirmada, cookies HttpOnly/SameSite, diagnósticos sin payload privado y manipulación del host/retorno. El backend y sus contratos no cambian. Este es un examen focalizado de privacidad y redirecciones, no una auditoría integral de toda la seguridad de Spring.

Referencias: [Next.js, redirect](https://nextjs.org/docs/app/api-reference/functions/redirect) permite rutas relativas; [OWASP, redireccionamientos](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) recomienda controlar los destinos y validar los componentes de URL. Se consultó `security-audit` en modo focalizado. La descarga de `modern-web-guidance` fue rechazada automáticamente por riesgo de suministro externo; la limpieza se basó en referencias locales y no aplicó guías descargadas.
