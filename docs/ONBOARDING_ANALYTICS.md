# Incorporación: progreso, datos y analítica

Integrante 4. Carpeta `services/progress-api/`; futura rama `feature/progress-analytics` desde `main` actualizado según [colaboración](GUIA_COLABORACION.md). Esta preparación no implementa progreso ni analítica.

## Estado existente

Node.js 24, Express y TypeScript, con `package-lock.json`. `src/app.ts`, `src/routes/health.routes.ts` y `src/controllers/health.controller.ts` exponen únicamente `GET /health`. `src/models/health.model.ts` consulta `system.local` de Cassandra. No hay rutas de intentos, progreso o indicadores, autenticación de negocio, keyspaces de progreso ni clientes Redis/ClickHouse implementados en este servicio.

Compose entrega variables de Cassandra y ClickHouse. Tener esas variables no acredita ingesta. `docker/clickhouse/10-academic.sql` prepara `academic_events` con MergeTree; no elimina duplicados por `event_id`. Redis existe en infraestructura y lo utilizan otros componentes; Express todavía no tiene conexión ni variables Redis propias. Las credenciales y configuración de servicio propuestas requieren un PR coordinado con el líder.

No modifiques web, seguridad principal, migraciones MySQL ni infraestructura compartida sin revisión. Los cambios CQL/SQL futuros pueden prepararse dentro de tu módulo para revisión; su aplicación y cualquier cambio de Compose requieren coordinación, respaldo y preservación de datos existentes.

## Entorno y primera verificación

Lee [roles](EQUIPO_ROLES.md), [contratos](CONTRATOS_EQUIPO.md), [arquitectura](ARCHITECTURE.md) y [H1](H1_RESULTADOS.md). Reutiliza el [arranque común](ONBOARDING_MOBILE.md#arranque-con-docker) y sus condiciones para instalaciones nuevas/existentes.

Con Node.js 24, desde la raíz:

```powershell
Push-Location services/progress-api
npm.cmd ci
npm.cmd test
Pop-Location
```

`npm test` compila TypeScript y ejecuta las pruebas de salud con un modelo inyectado; no demuestra persistencia real en Cassandra o ClickHouse. `npm run dev` compila y observa el servidor generado; después de editar TypeScript vuelve a compilar. Para integración usa Docker: Cassandra/ClickHouse no publican puertos al host y sus DNS no resuelven desde Windows. El servicio escucha internamente en `http://progress-api:3001`.

```powershell
# Instalación existente ya aprovisionada y arrancada
./scripts/Test-Siare.ps1
```

No abras las bases al host, no borres volúmenes ni publiques `.env`, tokens o configuración Compose expandida.

## Plan de trabajo posterior

1. Acordar con el líder el evento de intento evaluado, score normalizado, claves, errores y consultas; preparar fixtures del [contrato propuesto](CONTRATOS_EQUIPO.md). Spring valida usuario, propiedad y evaluación; Express recibe resultados del servidor, nunca puntajes confiados al móvil.
2. Diseñar tablas Cassandra según consultas por estudiante/materia y tiempo; limitar particiones, retención y paginación. Definir escritura durable, unicidad lógica de `attemptId`/`eventId`, conflicto de contenido y recuperación después de caídas. Probar reintentos concurrentes; un cache hit no acredita idempotencia durable.
3. Diseñar ingesta recuperable hacia ClickHouse, con checkpoint/reintento y deduplicación efectiva. No prometer transacción distribuida Cassandra/ClickHouse/Redis. Separar aceptación durable del evento de disponibilidad analítica; informar `asOf` y retraso.
4. Añadir después Redis con TTL e invalidación por estudiante/materia. Acordar prefijo propio; no tocar claves de OIDC. El TTL propuesto es 60 segundos; una versión de progreso debe impedir que una lectura anterior a la escritura repueble caché obsoleta. La caída Redis permite lectura de fuente durable y queda medida.
5. Implementar API y clientes en tu módulo, con autenticación interna propuesta, límites, trazas sin datos personales y errores sanitizados. Coordinar adaptadores y fachadas Spring mediante PR separado del líder.
6. Medir concurrencia y rendimiento con eventos distintos y duplicados, lecturas durante escrituras, caída/recuperación de dependencias y saturación. Registrar p50/p95, throughput, errores, atraso de ingesta, CPU/memoria y conteos esperados frente a reales. Mantener I/O acotado; el event loop solo no acredita trabajo de negocio concurrente.

## Evidencias para el PR

Entregar esquema y consultas reproducibles, pruebas de idempotencia/conflicto/autorización, demostración de progreso y agregados sobre eventos reales de prueba, ensayo de caché/invalidez/caída Redis y recuperación de ingesta. Anotar hardware, carga, configuración y resultados medidos. Usar UUID sintéticos; no correo, nombre, tokens, respuestas libres ni texto documental en eventos o capturas.

Relacionar pruebas con [matriz de requisitos](MATRIZ_REQUISITOS_EQUIPO.md). Un healthcheck, una tabla vacía o una captura de variables no acredita analítica. Hasta integrar actividades, puedes desarrollar con fixtures acordadas y etiquetadas como pruebas.
