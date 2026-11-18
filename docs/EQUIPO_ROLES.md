# Equipo de desarrollo SIARE Académico

Corte: 18/11/2026, America/Bogota. Base consolidada: `035d74e1e953573c24b9f1371cf604ce62b1a98b`, con PR #1, #2 y #3 fusionados. Esta preparación solo añade documentación mediante una rama y un PR propios. No repite merges ni crea ramas H2. Los nombres personales quedan por asignar; las responsabilidades corresponden a los cuatro puestos definidos por el usuario.

## Responsabilidades y límites

| Integrante | Rama futura desde main actualizado | Carpetas principales | Responsabilidad |
| --- | --- | --- | --- |
| 1: líder técnico | `feature/core-actividades` | `frontend/`, `services/core-api/` | Arquitectura e integración; backend Java Spring Boot hexagonal; autenticación, autorización, sesiones, MFA y OIDC; Abstract Factory para quiz y crucigramas; Next.js; diseño y experiencia de toda la plataforma; revisión de PR y pruebas finales |
| 2: móvil Android | `feature/mobile-react-native` | `mobile/` (prevista) | React Native, Expo y TypeScript; pantallas/navegación; login y MFA; consumo de API; materias/documentos; sesiones seguras; APK instalable y pruebas en Android |
| 3: aprendizaje adaptativo | `feature/ai-aprendizaje-adaptativo` | `services/content-ai/` | Python sobre Flask existente; análisis académico, dificultades, recomendaciones; entrenamiento/evaluación ML; API interna para Spring; concurrencia/paralelismo medidos; pruebas y documentación; conservar extracción documental |
| 4: progreso y analítica | `feature/progress-analytics` | `services/progress-api/` | Node.js, Express y TypeScript existentes; intentos/progreso; eventos Cassandra; indicadores ClickHouse; caché Redis con TTL e invalidación; integridad/idempotencia/trazas; concurrencia y rendimiento; API y evidencias |

El integrante 2 respeta la guía visual del líder y no modifica la web. El integrante 3 no modifica Abstract Factory, web, autenticación ni migraciones MySQL. El integrante 4 no modifica web, seguridad principal, migraciones MySQL o infraestructura compartida sin revisión. Cada integrante modifica archivos de otro responsable solo cuando sea estrictamente necesario y lo coordina previamente en el PR.

El líder revisa diseño e integración de los componentes de los otros tres integrantes. Cada autor escribe sus pruebas y documentación y firma sus propios commits. No se crean commits atribuidos a otro integrante.

## Archivos compartidos

| Área | Coordinación necesaria |
| --- | --- |
| `docs/CONTRATOS_EQUIPO.md`, `docs/CONTRATO_API_MOBILE.md`, `docs/openapi.json` | Líder y consumidor/productor afectados acuerdan el cambio antes de programarlo; actualizar contrato y pruebas en el PR correspondiente |
| `compose*.yml`, `docker/`, `scripts/`, `.env.example`, archivos Git de raíz | Líder revisa cambios de redes, puertos, recursos, variables y despliegue; no modificar para resolver unilateralmente necesidades del módulo |
| Flyway en `services/core-api/` | Líder; conservar V1–V4 aplicadas; cualquier evolución posterior requiere nueva migración y revisión de preservación de datos |
| `docs/` | Cada integrante mantiene su onboarding y evidencias; coordinar matriz, arquitectura y documentos comunes |
| Guía visual | El líder acuerda colores, tipografía, componentes, navegación y estados de carga/error; móvil implementa la adaptación en su carpeta |

La asignación es una regla del equipo. Este PR documental no configura CODEOWNERS ni protecciones técnicas de GitHub.

## Cómo empieza cada integrante

Primero seguir [colaboración](GUIA_COLABORACION.md) para crear la rama desde `main` actualizado, una vez integrado este PR documental. Las ramas de desarrollo se crearán al comenzar sus respectivos trabajos; esta actividad no las crea ni implementa módulos.

| Integrante | Primer trabajo en su futura rama | Guía y entrega inicial |
| --- | --- | --- |
| 1 | Leer arquitectura, puertos y fábricas existentes; revisar propuestas de contratos con 3 y 4; acordar estados visuales con 2 | [Arquitectura](ARCHITECTURE.md), [contratos](CONTRATOS_EQUIPO.md); casos de aceptación y plan de integración de actividades, sin alterar identidad existente |
| 2 | Revisar API local/MFA y preparar entorno Android/HTTPS; acordar guía visual con 1; después iniciar Expo en `mobile/` | [Onboarding móvil](ONBOARDING_MOBILE.md); primer PR móvil con pruebas propias, sin cambios web |
| 3 | Reproducir pruebas actuales de extracción; acordar dataset autorizado, etiquetas de temas y métrica con 1 | [Onboarding AI](ONBOARDING_AI.md); plan de datos/evaluación y fixtures sintéticas del contrato antes del modelo |
| 4 | Reproducir salud Express; revisar esquema ClickHouse e idempotencia; acordar eventos con 1 | [Onboarding analytics](ONBOARDING_ANALYTICS.md); diseño Cassandra/ingesta/caché y prueba de duplicados antes del flujo de progreso |

## Dependencias y trabajo simultáneo

Spring mantiene la autoridad sobre usuario, permisos, propiedad y evaluación de actividades. Web y móvil consumen Spring; no acceden directamente a Flask, Express ni bases de datos. El líder define el resultado evaluado de un intento; Express lo registra y entrega progreso/indicadores. Python analiza resultados autorizados enviados por Spring y devuelve dificultades/recomendaciones; no genera ni evalúa las familias Abstract Factory.

Móvil puede avanzar con login local, sesiones, MFA, materias y documentos existentes. AI y analytics pueden trabajar con fixtures sintéticas acordadas, identificadas como pruebas, mientras el líder desarrolla actividades. La integración real de ML depende de resultados académicos etiquetados; la de progreso depende de intentos evaluados. La visualización de recomendaciones e indicadores en web/móvil depende de sus futuras fachadas Spring. OIDC nativo y HTTPS Android requieren acuerdo adicional entre 1 y 2.

## Riesgos de integración

| Riesgo | Acuerdo de trabajo |
| --- | --- |
| Cambios incompatibles de JSON o rutas | Coordinar antes del código; ejemplos versionados, pruebas de productor/consumidor y plan de compatibilidad |
| Ediciones simultáneas en contratos, OpenAPI o Compose | PR pequeño por cambio; avisar responsable; resolver conflictos por archivo con ambos autores |
| Duplicados, caída entre Cassandra y ClickHouse, caché obsoleta | Persistencia durable e idempotencia, recuperación de ingesta y versión de caché; ver contrato propuesto |
| ML sin suficientes resultados o evaluación reproducible | Dataset autorizado y partición sin fuga; fixtures para desacoplar desarrollo; no declarar ML entregado por una regla fija |
| Entrenamiento bloquea extracción/OCR | Recursos y concurrencia acotados; medir extracción bajo carga ML; no elevar workers sin revisar memoria |
| Líder concentra seguridad, UI, actividades e integración | Priorizar contratos y PR pequeños; cada compañero aporta pruebas y evidencia de su módulo |
| Pruebas comparten límites de login o recursos de Docker | Ejecutar suites HTTP secuencialmente y coordinar carga; nunca borrar volúmenes/claves para restablecer un ensayo |

Trazabilidad académica: [matriz de requisitos](MATRIZ_REQUISITOS_EQUIPO.md). Los resultados históricos siguen en sus informes; GitLab OIDC tiene [confirmación manual reportada por el usuario](H2B2_GITLAB_REAL.md), independiente de los tests automatizados.

## Validación de esta preparación documental

El 18/11/2026 se verificó que `main`, `origin/main` y el remoto apuntaban a la base indicada, con árbol inicial limpio. Se creó únicamente `docs/organizacion-equipo-contratos`; no se repitieron merges de consolidación ni se recrearon ramas H2.

La revisión local comprueba que los 15 archivos preparados son Markdown: cinco nuevos y diez actualizados. Pasaron `git diff --check`, 137 enlaces/anclas locales y 12 ejemplos JSON. OpenAPI conserva 42 rutas, 47 operaciones y 403 referencias locales resueltas; no incluye las rutas propuestas de actividades, aprendizaje o progreso. Se contrastaron las interfaces existentes con controladores/adaptadores. Gitleaks 8.30.1 revisó una copia de los 15 documentos publicables sin hallazgos; esta comprobación no equivale a una auditoría exhaustiva.

No se modifican aplicaciones, dependencias, configuración, infraestructura ni migraciones. Las suites funcionales y Docker no se repiten en este cambio documental: conservan su evidencia histórica. La prueba manual de GitLab corresponde al reporte del usuario, sin nuevos artefactos. La publicación se realiza mediante PR hacia `main`; su revisión e integración son posteriores a esta preparación.
