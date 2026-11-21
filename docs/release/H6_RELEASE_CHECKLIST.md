# H6-7A — Verificación de release

Estado de preparación: **GO CON RESTRICCIONES** para revisión del candidato. No autoriza merge ni despliegue en 3100. OIDC externo, SMTP y verificaciones manuales permanecen [pendientes](H6_KNOWN_LIMITATIONS.md).

## Referencias y aislamiento

- Base `origin/main`: `c8f934492f0cc7809282657270df34b4474915ca`, igual a main local tras fetch.
- H6 verificado: `2cc4575a5ddc636d61e0020877ba88ddfab2f285`, igual al HEAD publicado de #15.
- Rama candidata: `release/h6-sorvo-consolidation`; corrección inicial: `21df47d`.
- Revisión de código compilada, probada y desplegada: `b0d5959d0354befdc6cae88ee1abd944bfaa8090`. Árbol `frontend`: `d7c0ff7905bbacb98c82664ca0568bb5afafc8e0`. Los commits posteriores de cierre contienen únicamente documentación y evidencias; se comprueba que conservan ese árbol exacto.
- Workspace habitual: `fix/document-compatibility-isolation` en `acba280`, con dos rutas modificadas y archivos no rastreados preexistentes. Se preserva. No se trasladan sus cambios al candidato.
- La cadena #10 → #11 → #12 → #13 y las fases landing → #14 → #15 se conservan por ascendencia. #8 y #9 permanecen fuera.

## Resultados de esta ejecución

| Comprobación | Resultado |
| --- | --- |
| Unitarias y componentes | 50/50 |
| Build Next.js | PASS; 15 pantallas y cinco handlers técnicos |
| TypeScript | PASS final sobre b0d5959 |
| Integración BFF actividades | 4/4, HTTP de loopback |
| Integración BFF identidad/OIDC | 8/8, proveedor controlado, callback de otro puerto rechazado |
| Integración estados Nexo | 5/5, Next/Chromium y roles controlados |
| Playwright completo | 125 PASS, 0 fallos, 0 flaky, 5 omisiones preexistentes; 130 casos, 8,9 minutos |
| Regresión de origen | Unitarias, BFF y navegador PASS; puertos explícitos, origen alternativo, Host/Forwarded y retornos manipulados |
| Despliegue efectivo 3107 | PASS; solo frontend-h6 recreado por Compose --no-deps y esperado healthy |
| Preservación 3100 | PASS; nueve servicios sin cambios durante el despliegue; salud UP; HTML y captura exactamente iguales |
| Privacidad | Cinco avisos Gitleaks de hashes de integridad, contrastados con fuente Git; cero credenciales confirmadas |
| Comparación íntegra contra main | Git local y manifiesto; sin diferencias en servicios, móvil, Compose o migraciones |
| HEAD publicado / PR draft | Regresión aprobada; publicación del cierre documental y apertura draft directamente a main |

Los intentos iniciales fallidos no se omiten: la copia de dependencias estaba incompleta en la primera ejecución unitaria; tras completarla pasaron las 50 pruebas. La primera corrida E2E terminó con 108 PASS, 17 fallos y cinco omisiones: detectó diferencias del nuevo proveedor con los contratos (acceso ajeno, filtrado de fuentes, campos de envío, OCR y documento sin texto) y recorridos heredados que buscaban controles de escritorio desde móvil o comprobaban Administración después de visitar Apariencia. Se corrigieron fixture y recorridos sin relajar aserciones ni añadir skips. Una segunda corrida fue interrumpida tras 34 casos y señaló una carrera de navegación al cambiar cookies por API con el observador de cuenta activo; ST-10 ahora deja esa pantalla antes de cambiar de cuenta, conserva la copia y verifica el aislamiento. La corrida final completa aprobó 125 casos sin fallos ni reintentos flaky.

Las cinco omisiones ya existían: repetición móvil de las matrices de landing, estados académicos, rutas globales, contraste semántico y óptica Sorvo. Esas matrices incluyen tamaños móviles en escritorio; las regresiones funcionales móviles sí se ejecutaron. Los nombres históricos de casos que mencionan Spring no convierten el proveedor en memoria en una integración real de backend. [Detalle de los 130 casos](evidence/playwright-summary.json).

Se verificaron 912 muestras automatizadas de contraste en la galería, sin fallos, además de foco/teclado, colores forzados, movimiento y transparencia reducidos. Esta evidencia no certifica WCAG completo ni sustituye las comprobaciones manuales.

## Evidencia

Los logs completos, JSON de Playwright, resultados de integración y matrices visuales se generan en `.cache/h6-release/` del worktree; [el resumen revisado](evidence/README.md) y logs sin datos privados se conservan en `docs/release/evidence/`. El navegador público y snapshots Docker completos están en `.cache/h6-release/` del workspace raíz. No se publica el entorno, cookies, tokens ni documentos privados.

La configuración release prepara automáticamente `academic.pdf`, `scanned.pdf` y `blank.pdf` desde las fixtures rastreadas, cuya procedencia es el generador Python existente. Se usan únicamente como datos del proveedor en memoria; no se suben al core real. Mantener las salidas visuales en `.cache`, mediante las variables del plan.

## Criterios de decisión

GO exige navegación de origen correcta, regresiones obligatorias aprobadas, imagen realmente activa en 3107, salud y preservación de 3100 y ausencia de bloqueantes de privacidad o datos. Las integraciones externas y verificaciones manuales se registran separadamente. Cualquier fallo funcional sin resolver mantiene **NO-GO** y bloquea publicación como candidato apto.

## Despliegue y reversión registrados

Proyecto `siare-h6-3-validation`, servicio `frontend-h6`, puerto `127.0.0.1:3107`, contenedor `4d12c6d95517522a6cdaf5f2eaec9a1a04e3b85ec5ffa5dfdafea76aa20e3848`, healthy.

- Imagen activa `siare-academico-frontend:h6-7a-candidate`: `sha256:eace36387c2eb90d2a268af12999998e0bf769e3d1936927c4cd09f2393663cd`.
- Reversión conservada `siare-academico-frontend:h6-7a-rollback`: `sha256:04a6543ae6ecd2cc5baf6c1df7eb2cf674ebf141a788e31c3bd24609799a0167`.
- `APP_ORIGIN` efectivo: `http://127.0.0.1:3107`; la fixture de pruebas no está incluida en el runtime.
- `.env` y configuración Compose, salvo imagen/etiquetas de preview, conservados. No se recrearon dependencias, redes ni volúmenes.
- Durante la interrupción de la sesión se observaron arranques nuevos de los nueve servicios, con los mismos IDs e imágenes. Se guardaron ambas observaciones y una referencia nueva antes del despliegue; los arranques no cambiaron durante la operación selectiva.
- [IDs, imágenes, salud y navegador](evidence/deployment.json); [procedimiento de reversión](H6_INTEGRATION_PLAN.md). No se ejecutó la reversión porque la preview quedó healthy.

La captura pública de 3107 también conserva el hash anterior, por lo que el ajuste no cambió la landing aprobada. Las pruebas autenticadas se ejecutaron exclusivamente contra el entorno en memoria.
