# Evidencia H6-7A

Código probado y desplegado: `b0d5959d0354befdc6cae88ee1abd944bfaa8090`; rama `release/h6-sorvo-consolidation`. Los cierres documentales conservan el árbol frontend exacto indicado en la checklist.

| Evidencia | Alcance |
| --- | --- |
| `playwright-summary.json` | 130 casos: 125 aprobados, cinco omisiones preexistentes, cero fallos/flaky; explicación de corridas previas |
| `unit-final.txt`, `build-final.txt`, `typecheck-final.txt` | 50 unitarias/componentes, build y TypeScript |
| `activities-final.txt`, `identity-final.txt`, `nexo-final.txt` | 4 + 8 + 5 integraciones controladas |
| `visual-accessibility.json` | Matrices visuales y 912 muestras de contraste sin fallos; límites manuales explícitos |
| `deployment.json` | Preview activa healthy, imagen/commit/contenedor; preservación de nueve servicios y navegador 3100 |
| `privacy.json` | Cinco avisos de hashes de integridad, cero credenciales confirmadas; no se ocultan los exit codes Gitleaks |
| `preservation.json` | Recursos H6 y workspace conservados; H5/backend/migraciones excluidos; formato de tres logs históricos |
| `preview-3107.png`, `habitual-3100.png` | Navegador público posterior al despliegue; sin cuentas ni datos académicos |
| `appearance-dark.jpg`, `crossword-dark.jpg` | Apariencia y Cuaderno A con datos sintéticos contra proveedor en memoria |
| `manifest.json` | Bytes y SHA-256 de los archivos de esta carpeta; textos canónicos UTF-8/LF |

Las pruebas de cliente ejecutan Next de producción, BFF, componentes, navegación, almacenamiento y cifrado reales. El upstream de memoria modela HTTP y no acredita autorización, evaluación, TOTP, extracción ni persistencia reales de Spring. No hubo escrituras de pruebas en las bases habituales. OIDC externo, SMTP, roles privilegiados reales y verificaciones manuales ampliadas permanecen pendientes.
