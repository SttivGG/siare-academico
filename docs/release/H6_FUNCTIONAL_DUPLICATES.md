# H6: solapamientos y propuestas que se conservan

Esta revisión distingue identidad de bytes, similitud visual y coincidencia de
responsabilidad. El [inventario exacto](H6_EXACT_DUPLICATES.csv) contiene 111
grupos y 250 rutas; no demuestra por sí mismo que una copia carezca de función.

La [comparación visual](H6_VISUAL_SIMILARITY.csv) procesó 1936 imágenes históricas
con dHash de 64 bits (gris 9 × 8), comparando dimensiones originales iguales y
distancia hasta cuatro bits, con hasta tres vecinos por imagen. Encontró 1270
parejas de SHA-256 distinto. Es una señal para inspección, sensible a recortes,
texto y fondos uniformes; no identifica duplicados exactos ni autoriza borrado.
La exclusión de estas imágenes se justifica por su función histórica, aunque
contengan información visual única que permanece en el commit original.

| Archivos o grupo | Comprobación | Decisión |
| --- | --- | --- |
| `docs/examples/h3/*.json` y `frontend/tests/fixtures/h3/*.json` | Tres parejas idénticas: contrato documental y fixture de regresión tienen consumidores diferentes | Conservar; pertenecen a main y evitan dependencias de pruebas sobre documentación |
| Urbanist y licencia OFL de prototipo H6-1 frente a `frontend/public/fonts/` | Bytes idénticos, runtime consume la copia pública | Excluir el prototipo del candidato y conservar fuente/licencia públicas |
| `__init__.py` vacíos | La identidad de cero bytes no sustituye la estructura de paquetes Python | Conservar main |
| Matrices históricas H6 y matriz release | Comparten casos, pero las primeras fijan decisiones de una fase | Mantener solo la matriz release local y enlazar las anteriores por commit |
| `nexo.spec.ts`, `nexo-academic-states.spec.ts`, `sorvo-glass.spec.ts`, `appearance.spec.ts` | Hay capturas/rutas comunes; se comprueban estados, contraste/fallback, óptica y preferencias distintas | Conservar todas las aserciones y suites |
| `academic-state.test.mjs`, `cuaderno.spec.ts`, `nexo-recovery.spec.ts` | Estado puro, almacenamiento/navegador y ST-01 bloqueante cubren niveles distintos | Conservar |
| `siare-logo.png` y `siare-logo-clean.png` | Landing importa el PNG limpio; el anterior no tiene consumidor estático. Son imágenes diferentes y contienen píxeles únicos | Proponer archivado del anterior en otro cambio; conservar el árbol frontend aprobado |
| Fotografías completas y miniaturas WebP | Resolución y función diferentes; la galería descarga miniaturas y solo el fondo seleccionado | Conservar todas; no deduplicar por parecido |
| Capturas de una misma pantalla en fases/tamaños/temas | Muchas son idénticas; otras documentan estados distintos | Excluir todas las galerías intermedias del nuevo PR, preservando originales y hashes |
| `measure-h6.mjs` y `measure-h6-idle.mjs` | Miden interacción e inactividad distintas. No los ejecuta la suite release; algunos valores predeterminados apuntan a 3107 | Conservar código; proponer exigir un origen de fixture explícito antes de reutilizarlos |

El análisis AST de los 87 archivos fuente no dejó componentes o utilidades
aislados del grafo de imports fuera de las entradas convencionales App Router.
Incluye imports relativos estáticos, reexportaciones e `import()`/`require`
literales. El informe [frontend](H6_FRONTEND_REVIEW.json) conserva el grafo y
los candidatos léxicos de estilos; no supone que un nombre ausente pruebe
inutilidad ante clases dinámicas, APIs del framework o composición de CSS.

TypeScript con `--noUnusedLocals --noUnusedParameters` detectó diez diagnósticos:
`Link` en registro y las dos páginas de recuperación; `INITIAL_BANK` en el
editor; `crosswordAnswers`, `freezeSubmission` y `Submission` en el jugador;
`DocumentSource`, `result` y `recent` en el workspace. El typecheck oficial
sí aprueba. Se propone un cambio posterior con nueva equivalencia y regresiones;
el candidato conserva expresamente el árbol aprobado.

El CSS global conserva dieciséis nombres sin consumidor léxico: las familias
`welcome-*`, `home-feature`, `feature-mark`, `phase-note`, `sessions-list`,
`list-toolbar`, `workspace-grid`, `quiet-panel`, `confirm-box`, `security-panel`,
`learning-grid`, `learning-card`, `future-indicators`, `future-activities` y
`workspace-jumps`. Se encontraron tokens de escala y alias Nexo sin consumo,
además de `--landing-glass`. Sus declaraciones repetidas dentro de temas,
breakpoints, `@supports` y reglas de accesibilidad son cascadas intencionales.
No se retiraron selectores basándose únicamente en esta búsqueda.

No se detectó una dependencia directa nueva sin función: Next/React componen
la aplicación, qrcode genera el QR, server-only protege módulos servidor,
Tailwind/PostCSS procesan CSS y TypeScript/Playwright/tipos sostienen build y
pruebas. Las suites visuales usan `sharp`, resuelto por la dependencia fijada de
Next; no se cambia el lockfile. Los nombres Nexo de tests/componentes históricos
no representan una segunda aplicación: comprueban el frontend Sorvo vigente.

## Propuestas separadas sobre main y áreas del equipo

`PLAN_ENTREGA_2026_2.md` conserva un corte que llama pendientes a actividades ya
entregadas en H3/H4. `CONTRATOS_EQUIPO.md` también contiene una tabla inicial de
interfaces de ese corte. `H4_FRONTEND.md` describe el diseño anterior a Sorvo.
El índice documental identifica sus fechas y autoridad limitada. Actualizar
esos textos exige revisar con sus responsables; este candidato no los modifica.

Los manuales H0-H5, resultados de seguridad, guías móviles/ML/analítica y
contratos tienen información única de evaluación, incorporación o trazabilidad.
La ausencia de consumidores en código no permite borrarlos. Las capturas H4
ya presentes en main se conservan. No se incorporan cambios locales de otros
compañeros, V6 ni los contratos de H5 de sus worktrees.
