# H6-0: adaptación de las skills para SIARE

Este documento es la adaptación específica del flujo DakaDesing para SIARE Académico. Se aplica desde la rama H6 y no modifica ni instala una copia de las skills globales. El [plan original](H6_PLAN.md) y `AGENTS.md` del proyecto prevalecen sobre ejemplos genéricos o de Ambrosia.

## Lectura y dependencias verificadas

Se leyeron íntegramente los tres SKILL.md solicitados. Sus hashes originales quedan en [skills-origen.json](evidencias/h6-0/skills-origen.json).

| Skill local | Procedimiento y recursos | Aplicación en H6 |
| --- | --- | --- |
| `C:/Users/Daniel Giraldo/.agents/skills/ui-ux-pro-max/SKILL.md` | Python 3, sin dependencias externas. Script `scripts/search.py`, catálogo local, referencias de reglas y stacks. Consulta mínima por dominio, stack independiente; sistema global con `--design-system` cuando proceda. Verificar pertinencia antes de persistir. | Auditoría: navegación por teclado y fronteras servidor/cliente de Next.js. H6-1: contrastar cualquier propuesta del generador con Nexo; no adoptar su paleta/fuente por defecto. |
| `C:/Users/Daniel Giraldo/.agents/skills/modern-web-guidance/SKILL.md` | Node/npm y red para `npx.cmd -y modern-web-guidance@latest search`, seguida de `retrieve` de IDs pertinentes. Leer completo el archivo temporal cuando se redirige la salida. | Se buscó `responsive workspace panels` y se recuperaron completos `responsive-design` y `css-layout`. No se ejecutó `legacy-scan`, que no corresponde a esta auditoría delimitada. |
| `C:/Users/Daniel Giraldo/.codex/skills/dakadesing/SKILL.md` | Selección de referencia, diagnóstico, UI UX Pro Max, método claude-webkit, evaluación de diálogos y revisión funcional/visual. No autoriza commits/push ni ampliación funcional. | Referencia ya elegida: Nexo visual y NotebookLM organizativo. Se reemplazan supuestos de Ambrosia por rutas, stack, contratos y controles reales de SIARE. |

También se consultó `deslop` para redactar los informes con evidencia concreta y sin repeticiones. No se activaron imagegen, media-use o skills de vídeo: H6-0 no necesita generar recursos, motion ni vídeos.

### Consultas realizadas y calidad de la evidencia

```powershell
python -B 'C:/Users/Daniel Giraldo/.agents/skills/ui-ux-pro-max/scripts/search.py' 'keyboard focus navigation' --domain ux
python -B 'C:/Users/Daniel Giraldo/.agents/skills/ui-ux-pro-max/scripts/search.py' 'server client components' --stack nextjs
npx.cmd -y modern-web-guidance@latest search 'responsive workspace panels' --skill-version 2026_11_09-5bcc021b
npx.cmd -y modern-web-guidance@latest retrieve 'responsive-design,css-layout'
```

La primera consulta devolvió navegación por teclado, foco visible y foco no oculto. La referencia de foco completamente visible se identifica como AAA en el catálogo; no se presenta como obligación AA. La consulta Next.js devolvió Server Components predeterminados y clientes interactivos limitados; sus metadatos se refieren a Next.js 16.2, mientras el proyecto fija 16.4.6. Cualquier API concreta deberá verificarse antes de implementar.

Las consultas `responsive mobile navigation` y `bottom navigation limits` devolvieron reglas generales de adaptación, foco y navegación, sin justificar un patrón móvil concreto. `unsaved form changes` y el reintento `preserve state navigation` tampoco devolvieron una regla específica para conservación de borradores. Los hallazgos de pérdida de estado se fundamentan en las pruebas reales y el código de SIARE, no en esos resultados genéricos. No se persistió ninguna salida automática del generador ni se inventaron coincidencias.

El buscador modern-web-guidance avisó de una versión posterior de su SKILL.md. Se conservó la instalación global. La salida de `retrieve` redirigió 342 líneas a un archivo temporal que se leyó completo; no se añade al runtime del proyecto.

## Sustituciones explícitas de DakaDesing

| Instrucción o ejemplo de origen | Adaptación SIARE |
| --- | --- |
| Diagnóstico de Ambrosia, `apps/admin-web` | Revisar `frontend/`, App Router, componentes, libs y documentación SIARE. No tocar Ambrosia. |
| Gateway `localhost:8080` | Navegador `http://127.0.0.1:3100`; Spring `127.0.0.1:8180` solo para validación pertinente. Conservar `APP_ORIGIN` y el host coherente. |
| Tipos/Prisma/Decimal e importes COP | Preservar las fronteras Next/Spring/Flask/Express existentes. No añadir Prisma, pagos o reglas financieras. Español y `es-CO`; America/Bogota para evidencias; UTC en persistencia/transporte. |
| Referencia intercambiable Steep | Nexo es identidad elegida; NotebookLM, estructura. No preguntar de nuevo ni mezclar paleta Steep. |
| Comandos `pnpm lint/typecheck/test/build` de Ambrosia | Los scripts SIARE usan npm. Usar `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run test:e2e` según cambios; no inventar `npm run lint`. Existe además `test:integration:activities`. |
| SweetAlert2 como herramienta del flujo | El plan H6 pide evaluarlo solo donde mejora una interacción. No instalarlo en auditoría ni sustituir confirmaciones semánticas funcionales automáticamente. |
| Ciclo de implementar y revisar | Antes de implementar, entregar propuesta visual y obtener la aprobación de fase indicada por el usuario. H6-0 queda documental. |
| Despliegue genérico del método externo | Aplicar exclusivamente Compose y controles oficiales SIARE; nueve healthy, frontend selectivo, reversión, sin volúmenes nuevos ni borrado de datos. |

## Método operativo adaptado

1. Leer el plan H6 y los AGENTS aplicables, comprobar rama, cambios existentes y despliegue efectivo. No asumir que el checkout habitual coincide con el runtime.
2. Registrar la fase solicitada y sus aprobaciones existentes. Auditar rutas, estados y contratos antes de proponer cambios visuales. Conservar el ámbito móvil del compañero y H5 #8/#9 fuera del delta H6.
3. Extraer valores desde Nexo verificable y separar observación de propuesta. Consultar las skills para el problema concreto, con las rutas absolutas indicadas. No persistir una propuesta genérica como sistema aprobado.
4. Diseñar el entregable de la fase fuera del código productivo. Mostrar claro/oscuro y tamaños pertinentes; usar datos reales o fixtures claramente identificadas para revisión, sin fabricar métricas o ML.
5. Tras la aprobación que corresponda, implementar en componentes existentes y tokens compartidos. Preservar responsabilidades, estado académico, cookies y contratos. No reescribir la aplicación ni introducir endpoints para completar una maqueta.
6. Comprobar función, teclado, foco, error, cancelación y resolución adaptable; capturar la instalación efectiva. Ejecutar solo pruebas adecuadas al cambio y registrar límites reales.
7. Cuando el código ejecutable cambie, reconstruir/recrear únicamente los servicios necesarios con controles oficiales; conservar imagen anterior y verificar salud/comportamiento en 3100. Documentación sola no exige desplegar. No hacer commit/push ni fusionar PR sin autorización explícita.

### Uso de claude-webkit

Se consultó su [repositorio](https://github.com/Hainrixz/claude-webkit) y las guías pertinentes [frontend-design](https://github.com/Hainrixz/claude-webkit/blob/main/.claude/skills/frontend-design/SKILL.md) y [web-design-guidelines](https://github.com/Hainrixz/claude-webkit/blob/main/.claude/skills/web-design-guidelines/SKILL.md), con sus [reglas de revisión](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md). Se adaptan diagnóstico, jerarquía, componentes y revisión visual. La fuente `building-components` no pudo recuperarse en dos consultas; no se considera leída ni se atribuyen reglas a ella.

El repositorio externo orienta a crear y publicar landing pages. Aquí no se ejecutan su scaffolding, instalación masiva o despliegue Vercel. Sus recomendaciones de optimismo visual no permiten anunciar una evaluación o una publicación antes de confirmarlas en Spring. Las preferencias estéticas generales no desplazan Urbanist, Nexo, legibilidad ni las aprobaciones del usuario.

### Inventario de diálogos y notificaciones

En el código revisado no se encontraron invocaciones a `window.alert`, `window.confirm` o `window.prompt`, ni alias de esas APIs. La coincidencia `async function confirm` en `mfa-panel.tsx` es un manejador local del formulario, no una llamada al diálogo nativo.

| Interacción | Implementación actual | Revisión prevista |
| --- | --- | --- |
| Archivar materia | Estado `confirm` y botones Confirmar archivo/Cancelar en línea | Ya se verificó cancelar sin archivar; elegir patrón H6 sin romper pending/errores. |
| Desconectar identidad | Confirmación en línea por identidad y sesión reciente | Conservar última vía de acceso y autorización; no sustituir por un aviso de éxito prematuro. |
| Vincular identidad | Checkbox explícito y POST OIDC | Mantener confirmación, contexto y redirección autorizada. |
| Revisar/publicar banco | Vista de revisión y checkbox antes de crear | Mantener como revisión académica, no reducirla a un modal genérico. |
| Cerrar sesiones | Petición directa por una/otras/todas | Evaluar confirmación proporcional, consecuencia y cancelación antes de mutar. |
| Envío pendiente | `beforeunload` mientras falta confirmar el intento | No reemplazar diálogo del navegador; conservar el mismo sobre/idempotencyKey. |
| Validación y resultados | Mensajes en línea, `role=alert/status` | No desplazar errores de campo ni feedback académico a toasts efímeros. |

Si se elige SweetAlert2 en H6-5, verificar su API oficial en ese momento, centralizar tema/comportamiento en frontend, usar texto seguro para contenido dinámico, esperar el resultado asíncrono y ejecutar una sola mutación tras confirmar. Probar foco/restauración, Escape y cierre durante pending, y ausencia de peticiones al cancelar. `<dialog>` y confirmación en línea siguen siendo alternativas disponibles.

## Entregas y aprobaciones

| Fase | Entrega que se revisa | Límite antes de avanzar |
| --- | --- | --- |
| H6-0 | Auditoría, referencias, adaptación, inventario y capturas actuales | Entrega documental completa; revisión del usuario antes de H6-1. |
| H6-1 | Tokens propuestos, catálogo/estados, prototipos claro/oscuro y decisiones | Aprobar identidad antes de aplicarla masivamente. |
| H6-2 | Shell escritorio/tableta/móvil, temas y teclado | Aprobar estructura global. |
| H6-3 | Tres paneles, fuente/actividad, persistencia de estado y resoluciones | Aprobación **expresa** de distribución por el usuario antes de acabados. |
| H6-4 | Grupos de pantallas completos | Capturas y validación funcional por grupo. |
| H6-5 | Motion, diálogos y recursos necesarios | Aprobación y ausencia de regresiones de accesibilidad/rendimiento. |
| H6-6 | Matriz visual y regresiones completas | Pruebas satisfactorias y diferencias revisadas. |
| H6-7 | Commits/PR autorizados, imagen y despliegue selectivo | No fusionar automáticamente; informe con revisión, imagen, contenedores, pruebas y límites. |

La lectura de una skill no satisface una aprobación. Las propuestas H6-1, H6-2 y H6-3 deberán ser concretas y revisables antes de pedir al usuario la decisión correspondiente. Esta adaptación no aprueba fases futuras ni autoriza cambios en las skills globales.
