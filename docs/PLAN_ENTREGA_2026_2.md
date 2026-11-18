# Plan de entrega SIARE 2026-2

Corte: 11/11/2026. Entrega: **25/11/2026**. Sustentación: **02/12/2026**.
H0/H1 están implementados y H2-A incorpora identidad local, roles, ámbitos,
sesiones, auditoría y paneles iniciales. H2-B1 implementa TOTP y habilita permisos
administrativos únicamente tras MFA verificado, con recuperación offline y tokens
de contraseña. Entrega SMTP real pendiente; pruebas con captura de mensajes.
Consulta [H2A_IDENTIDAD.md](H2A_IDENTIDAD.md) y [H2A_VALIDACION.md](H2A_VALIDACION.md).
Consulta [H2B1_VALIDACION.md](H2B1_VALIDACION.md). H2-B2 añade OIDC con prueba controlada; la integración real con ambos proveedores y el APK continúan pendientes. Los responsables siguientes son
propuestas por función; el equipo debe asignar los nombres y confirmar capacidad.

## Matriz de requisitos

| Requisito del instructivo recibido | Estado H1/H2-A/H2-B1 | Evidencia o trabajo pendiente | Responsable propuesto |
| --- | --- | --- | --- |
| Tres backends con tecnologías diferentes | Parcial | Spring, Flask y Express ejecutables; Express solo tiene salud y conexión Cassandra | Backend |
| Principal con arquitectura hexagonal | Implementado para Fases 1 y 2 | Dominio/aplicación Java, puertos y adaptadores; mantener fronteras en H2-H4 | Arquitectura |
| Web y APK Android instalable | Parcial | Next.js operativo; crear React Native y entregar APK firmado instalable | Web / móvil |
| Cinco motores distintos | Infraestructura H1 | MySQL, MongoDB, Cassandra, Redis, ClickHouse; ingesta OLAP pendiente | Datos / infraestructura |
| Cinco módulos funcionales | Parcial | Identidad local, materias y documentos; implementar actividades y seguimiento/analítica con criterios funcionales | Backend / producto |
| Tres mecanismos avanzados reales | Pendiente de aceptación | Propuesta: ML evaluado, procesamiento asíncrono acotado, caché coherente con invalidación; documentar demostración de cada uno | Backend / ML |
| Concurrencia o paralelismo en cada backend | Parcial | Spring: ejecutor acotado; Flask: threads y subproceso terminable; Express: I/O asíncrono, falta trabajo concurrente de negocio demostrable | Backend |
| Login local y dos proveedores OIDC externos | Parcial | Login local y Google reales confirmados; GitLab.com implementado con pruebas controladas, pendiente de registro y validación real | Identidad |
| USER, ADMIN y SUPERADMIN | H2-A/H2-B1 | Roles/ámbitos persistidos; permisos administrativos ligados a sesión MFA vigente; refresh no eleva privilegios | Identidad |
| MFA para administradores y recuperación | H2-B1; entrega SMTP pendiente | TOTP, alta provisional, QR, recuperación offline, tokens de contraseña y pruebas; validar buzón real y ensayo institucional de pérdida total | Identidad |
| Sesiones renovables y revocables | H2-A | Access corto, refresh opaco rotatorio, detección de reutilización, logout y revocación duradera, inactividad y caducidad absoluta | Identidad |
| Dos Compose y red externa compartida | H1 | Datos/aplicaciones separados; red interna de Docker administrada fuera del ciclo de Compose | Infraestructura |
| OpenAPI, pruebas y documentación | Parcial | Contratos Fases 1/2/H2-A/H2-B1/H2-B2 y pruebas controladas; validar proveedores reales/SMTP y ampliar H3/H4 | QA / documentación |
| Abstract Factory obligatorio | Contratos solamente | Implementar familias Quiz/Crossword con generador, evaluador y política de feedback; demostrar uso real desde un caso de aplicación | Actividades |

La matriz deriva del texto proporcionado por el usuario. No se recibió el
instructivo original ni una rúbrica con ponderaciones. La conexión y una tabla
vacía en ClickHouse no acreditan un módulo analítico funcional. Express tampoco
cuenta todavía como un módulo de negocio completo.

## Hitos y aceptación

| Hito | Fechas propuestas | Entregable y criterio de aceptación | Responsable propuesto |
| --- | --- | --- | --- |
| H0: proteger Fase 2 | 10/11 | Revisión de archivos y secretos; pruebas reales; commit local identificado; rama H1 sin push | Arquitectura / QA |
| H1: datos y despliegue | 10-11/11 | Respaldo previo y recuperación; nueve servicios saludables; cinco motores sin puertos públicos; nombres, datos y RSA conservados; SQL desde Express; dos Compose válidos | Infraestructura / datos |
| H2: identidad y móvil inicial | 11-15/11 | Dos OIDC más local; tres roles; MFA obligatorio de administradores; recuperación; renovación y revocación probadas; React Native conecta y permite login real | Identidad / móvil |
| H2-A: identidad local | 10/11 | Roles/ámbitos, Argon2id compatible con BCrypt, sesiones/auditoría, BFF y pantallas iniciales; privilegios bloqueados hasta MFA | Identidad / web / QA |
| H2-B1: MFA y recuperación | 11/11 | TOTP, permisos administrativos sujetos a MFA, recuperación offline y tokens de contraseña; captura de correo en pruebas, entrega SMTP real pendiente | Identidad / web / QA |
| H2-B2: OIDC web | 11/11 | Code + PKCE, Google/GitLab.com, vinculación y sesiones/MFA; Google real confirmado, GitLab pendiente de credenciales | Identidad / web / QA |
| H2-B: identidad externa y MFA | 11-15/11 | OIDC real, MFA administrativo, recuperación y habilitación de privilegios vinculada a MFA; APK en frente móvil | Identidad / móvil |
| H3: actividades y ML | 14-19/11 | Quiz/Crossword usan fábricas concretas; generación/evaluación/feedback persistentes; ML con dataset, métrica y ejecución reproducible; concurrencia de negocio en los tres backends | Actividades / ML |
| H4: seguimiento y analítica | 18-22/11 | Eventos reales, ingesta ClickHouse idempotente, consultas y dashboard; cinco módulos recorribles desde web y móvil; tres mecanismos avanzados demostrables | Datos / web / móvil |
| H5: cierre y sustentación | 23-25/11; ensayo 26/11-01/12 | APK instalable verificado en dispositivo; OpenAPI; pruebas de roles/MFA/OIDC/concurrencia; informe y diagramas; instalación y restauración reproducibles; ensayo completo antes del 02/12 | QA / equipo |

H2-H4 se solapan solo si hay personas disponibles y contratos acordados. El
responsable de arquitectura debe ajustar el alcance con el docente si el equipo
no puede sostener esas tareas en paralelo.

## Riesgos y dependencias

| Riesgo | Dependencia y medida |
| --- | --- |
| Quince días hasta la entrega | Asignar nombres y prioridades el 11/11; revisar cada hito con demostración ejecutable |
| OIDC y MFA bloquean clientes | Obtener cuentas de proveedor, redirect URI y credenciales pronto; mantener secretos fuera de Git; acordar contrato móvil |
| APK y red local | Disponer de Android SDK/dispositivo y definir URL accesible para el móvil; los puertos loopback actuales son para Windows local |
| Recursos de 16 GB y Docker/WSL | Limitar memoria y paralelismo; builds secuenciales; medir carga real antes de ampliar workers |
| Datos persistentes y RSA | Respaldo en frío antes de migrar; restaurar a volúmenes nuevos ante corrupción; no sustituir claves ni borrar volúmenes |
| Eventos duplicados y privacidad | Diseñar IDs, reintentos e ingesta idempotente; usar UUID en OLAP, evitar correo/nombre/texto documental en eventos |
| Requisitos avanzados ambiguos | Acordar con el docente qué evidencia acredita cada mecanismo; no contar healthchecks ni placeholders como funcionalidad |
| ML sin evaluación | Seleccionar dataset autorizado, separar evaluación y fijar métrica antes del modelo |

El informe final debe distinguir resultados medidos, límites y pendientes. En
H1 no se implementan React Native, OIDC, RBAC, MFA, recuperación, nuevas sesiones,
ML, nuevos módulos, fábricas concretas ni OpenAPI. La implementación de H1 queda
descrita en [MIGRACION_H1.md](MIGRACION_H1.md); sus resultados reales se registran
en [H1_RESULTADOS.md](H1_RESULTADOS.md).

## Actualización H2-B2 — 11/11/2026

El segundo proveedor se cambia de Microsoft Entra a GitLab.com por falta de suscripción/configuración de facturación para registrar la aplicación Microsoft. Se conserva Google, con login y alta reales confirmados. Ambos usan PKCE, vinculación explícita, MySQL/Redis y continuidad MFA. GitLab requiere registro, credenciales y recorrido real; sus pruebas controladas no acreditan esa integración externa. La entrega real SMTP sigue pendiente anterior de H2-B1; React Native sigue pendiente. Evidencia y límites en [H2B2_VALIDACION.md](H2B2_VALIDACION.md).
