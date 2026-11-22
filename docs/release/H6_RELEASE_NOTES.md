# H6-7C: candidato ligero de Sorvo

Preparación del 21/11/2026 (America/Bogota), en `release/h6-sorvo-main-final`,
desde `origin/main` `c8f934492f0cc7809282657270df34b4474915ca`.
El frontend procede de `597d045f8bcdbc14a2e68f4d7d8cdc435267c98f` y conserva
el árbol probado `d7c0ff7905bbacb98c82664ca0568bb5afafc8e0`.

Incluye la landing y PNG limpio aprobados, Sorvo global, navegación lateral,
encabezado, cuenta inferior, temas Claro/Oscuro/Sistema y Apariencia con cinco
fotografías y Sin imagen. Conserva Cuaderno A, Fuentes | Aprendizaje | Estudio,
Quiz, Crucigramas, revisión humana del banco, continuidad por actividad,
envío idempotente y recuperación local cifrada opcional.

Mantiene autenticación, MFA y los controles de origen del BFF: configuración
explícita `APP_ORIGIN`, retornos internos relativos y rechazo de callbacks OIDC
que pertenezcan a otro entorno. Los servicios, contratos, migraciones y
credenciales de main no cambian. H5 #8/#9, Flyway V6 y generación ML quedan fuera.

Se trasladan el código, las pruebas y las fixtures de H6 sin retirar escenarios,
añadir omisiones o relajar aserciones. Las 15 rutas y 58 filas de aceptación
permanecen en la [matriz](H6_RELEASE_MATRIX.csv). Los resultados de ejecución se
generan en `.cache/`; las galerías anteriores se consultan mediante el
[archivo histórico con SHA-256](H6_HISTORICAL_ARCHIVE.csv).

La clasificación abarca main, H6 y grupos locales de los worktrees. El
[informe de limpieza](H6_CLEANUP_FINAL.md) distingue exclusiones del candidato
de propuestas sobre archivos que se conservan. No se borra ninguna rama ni
evidencia original. Mantenerlas en este remoto no equivale a un respaldo externo
ni reduce el almacenamiento del historial Git existente.

Consultar [validación y decisión](H6_RELEASE_CHECKLIST.md),
[despliegue y reversión](H6_INTEGRATION_PLAN.md),
[limitaciones](H6_KNOWN_LIMITATIONS.md) e [índice documental](../INDEX.md).
El [PR #17](https://github.com/SttivGG/siare-academico/pull/17) permanece abierto.
Este candidato no autoriza merge ni despliegue sobre 3100; tampoco modifica 3107.
