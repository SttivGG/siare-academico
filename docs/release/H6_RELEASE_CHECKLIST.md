# H6-7A — Verificación de release

Estado de preparación: **EN CURSO**. No autoriza merge ni despliegue en 3100.

## Referencias y aislamiento

- Base `origin/main`: `c8f934492f0cc7809282657270df34b4474915ca`, igual a main local tras fetch.
- H6 verificado: `2cc4575a5ddc636d61e0020877ba88ddfab2f285`, igual al HEAD publicado de #15.
- Rama candidata: `release/h6-sorvo-consolidation`; corrección inicial: `21df47d`.
- Workspace habitual: `fix/document-compatibility-isolation` en `acba280`, con dos rutas modificadas y archivos no rastreados preexistentes. Se preserva. No se trasladan sus cambios al candidato.
- La cadena #10 → #11 → #12 → #13 y las fases landing → #14 → #15 se conservan por ascendencia. #8 y #9 permanecen fuera.

## Resultados de esta ejecución

| Comprobación | Resultado |
| --- | --- |
| Unitarias y componentes | 50/50 |
| Build Next.js | PASS; 15 pantallas y cinco handlers técnicos |
| TypeScript | PASS inicial; repetición final pendiente |
| Integración BFF actividades | 4/4, HTTP de loopback |
| Integración BFF identidad/OIDC | 8/8, proveedor controlado, callback de otro puerto rechazado |
| Integración estados Nexo | 5/5, Next/Chromium y roles controlados |
| Playwright completo | EN CURSO; sin nuevas omisiones |
| Regresión de origen | Unitarias y BFF aprobadas; navegador completo en curso |
| Despliegue efectivo 3107 | PENDIENTE de imagen y verificaciones |
| Preservación 3100 | Baseline de nueve contenedores healthy y navegador guardado; comparación final pendiente |
| Privacidad | Cinco avisos Gitleaks de hashes de integridad, contrastados con fuente Git; cero credenciales confirmadas |
| Comparación íntegra contra main | Git local y manifiesto; sin diferencias en servicios, móvil, Compose o migraciones |
| HEAD publicado / PR draft | Pendiente de regresión final |

Los intentos iniciales fallidos no se omiten: la copia de dependencias estaba incompleta en la primera ejecución unitaria; tras completarla pasaron las 50 pruebas. La primera corrida E2E detectó diferencias del nuevo proveedor de pruebas con los contratos reales (estado HTTP de acceso ajeno, filtrado de fuentes de preguntas, campos de envío, OCR y documento sin texto). Se corrige la fixture, sin relajar las aserciones funcionales ni añadir skips. Los resultados definitivos se registrarán aquí.

## Evidencia

Los logs completos, JSON de Playwright, resultados de integración y matrices visuales se generan en `.cache/h6-release/` del worktree; se promueve únicamente el resumen revisado a `docs/release/evidence/`. El navegador público de 3100/3107 y los snapshots Docker están en `.cache/h6-release/` del workspace raíz. No publicar el entorno, cookies, tokens ni documentos privados.

Para preparar los tres PDF sintéticos locales de esta instalación, copiar `academic.pdf`, `scanned.pdf` y `blank.pdf` desde `.cache/phase2-fixtures/` del workspace habitual al mismo directorio relativo del worktree. Se usan únicamente como datos del proveedor en memoria; no se suben al core real. Mantener las salidas visuales en `.cache`, mediante las variables del plan.

## Criterios de decisión

GO exige navegación de origen correcta, regresiones obligatorias aprobadas, imagen realmente activa en 3107, salud y preservación de 3100 y ausencia de bloqueantes de privacidad o datos. Las integraciones externas y verificaciones manuales se registran separadamente. Cualquier fallo funcional sin resolver mantiene **NO-GO** y bloquea publicación como candidato apto.

La decisión final, revisión exacta, imágenes, contenedores y pruebas se consignan al completar esta checklist.
