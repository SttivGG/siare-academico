# Validación H4 — 19/11/2026

Rama `feat/h4-educational-frontend`, creada desde `origin/main` actualizado
`6c3a742abd7c344c1810af699ba4ff10d0678c35`. Se utilizó un worktree independiente
para conservar la rama y los cambios documentales que ya estaban en el checkout
principal. El PR no modifica Spring, Python, Express, móvil, migraciones ni datos
existentes. Las pruebas HTTP reales crean cuentas/materias/documentos sintéticos
en la instancia local; no eliminan recursos existentes ni reinician servicios.

## Resultados

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck` | Correcto |
| `npm test` | 30/30, incluidas cuatro pruebas de componentes TSX reales |
| `npm run build` | Correcto, Next.js 16.4.6, producción standalone |
| `docker build -t siare-h4-frontend-validation:20261119 frontend` | Correcto: 30 pruebas, build y TypeScript con Node 24.22.2, fuente y licencia incluidas en runtime |
| `npm run test:integration:activities` | 4/4, servidor Next compilado y upstream HTTP aislado |
| Playwright escritorio 1440×1000 y móvil 375×812 | 16/16 contra Spring local y frontend standalone H4 |
| Zoom de texto 200% y movimiento reducido móvil | Sin desbordamiento horizontal del documento |
| Capturas e inspección visual | Tres paneles en escritorio; paneles apilados y enlaces de salto en móvil |

Playwright ejecutó `activities.spec.ts`, `phase-one.spec.ts`, `phase-two.spec.ts`,
`identity.spec.ts` y `mfa.spec.ts`, en ambos proyectos. Chromium existente revisión
1243 mediante `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; no se descargó el navegador
1254 esperado por defecto por la versión instalada de Playwright. Duración final:
1,3 minutos. Node host 24.14.0. Las pruebas no acreditan compatibilidad con WebKit
o Firefox ni una auditoría manual con lector de pantalla.

Capturas del recorrido real con contenido sintético:

- [Escritorio](capturas/h4/escritorio.png)
- [Móvil](capturas/h4/movil.png)

## Cobertura del recorrido real

Crear materia → cargar PDF sintético → procesar → confirmar READY → seleccionar
fuente → importar banco JSON → comprobar fragmentos/citas → revisar y confirmar
→ crear Quiz → resolver → enviar → recibir evaluación autorizada → consultar ID
de intento → repetir con Crucigrama → escribir celdas y usar flechas → evaluación
→ consultar resultado guardado.

También se verificaron:

- Ningún botón de selección de fuente antes de READY; ningún resultado ficticio
  en la materia nueva ni soluciones en el DTO público o jugador antes de evaluar.
- Importar `validated:true` no habilita publicar sin revisión explícita.
- Pérdida controlada de respuesta después de que **Spring guarda** la evaluación.
  El segundo envío mantiene exactamente el mismo JSON, incluida clave y duración.
  Las respuestas quedan bloqueadas entre ambos envíos.
- Catálogo de 22 actividades: carga inicial 20, cursor hasta completar 22, sin
  duplicados; dos páginas HTTP de tamaño 1 tienen actividades distintas.
- Banco estructuralmente válido mayor de 16 KiB aceptado por Spring mediante BFF.
- Cookie de acceso eliminada: la carga del catálogo renueva desde HttpOnly.
- Envío de `score` desde el cliente rechazado con 400; consulta ajena rechazada
  con 403; reenvío confirmado conserva resultado incluso tras archivar materia.
- Materia archivada: preparación deshabilitada y consultas conservadas.
- Regresiones de registro/login, edición/archivo de materia, subida/texto/descarga
  de PDF, renovación y revocación de sesión, MFA y recuperación de contraseña.
- Cero excepciones de página en el recorrido H4 y ningún uso de localStorage.

La integración HTTP aislada usa las rutas Next reales; su upstream controlado
permite comprobar bytes/cabeceras sin suplantar la evaluación real de los recorridos
Playwright. Comprueba las cinco operaciones, allowlist negativa, cursor inválido,
falta de sesión, CSRF, límites por bytes sin Content-Length y cookies de renovación.

## Rendimiento observado

En la ejecución local final, DOMContentLoaded fue 398 ms en escritorio y 176 ms
en móvil; los scripts de la navegación transfirieron 157 423 bytes codificados
en cada caso. Son observaciones de una ejecución local, sin emulación de red/CPU
ni percentiles de producción. La prueba limita los scripts a menos de 1 MiB.
Urbanist se sirve localmente (27 752 bytes), con `font-display:swap`; los efectos
de vidrio se limitan a los paneles. No se obtuvieron mediciones de campo de CWV.

## Reproducción

Con Node 24, Spring disponible y sin usar el puerto del frontend existente:

```powershell
cd frontend
npm ci
npm test
npm run typecheck
npm run build
npm run test:integration:activities

# La distribución standalone requiere estáticos y public, como el Dockerfile.
Copy-Item .next/static .next/standalone/.next/static -Recurse -Force
Copy-Item public .next/standalone/public -Recurse -Force
$env:CORE_API_URL='http://127.0.0.1:8180'
$env:APP_ORIGIN='http://127.0.0.1:3184'
$env:SESSION_COOKIE_SECURE='false'
$env:HOSTNAME='127.0.0.1'
$env:PORT='3184'
node .next/standalone/server.js
```

En otra terminal, desde `frontend`:

```powershell
$env:E2E_BASE_URL='http://127.0.0.1:3184'
# Usa tu navegador Playwright instalado; opcionalmente indica su ejecutable:
# $env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:/ruta/chrome.exe'
npx playwright test tests/e2e/activities.spec.ts tests/e2e/phase-one.spec.ts tests/e2e/identity.spec.ts tests/e2e/mfa.spec.ts
```

`phase-two.spec.ts` necesita además el fixture académico preparado por la
validación de Fase 2 en `.cache/phase2-fixtures/academic.pdf`, fuera de `frontend`.
H4 genera su propio PDF sintético sin depender de ese fixture.

## Límites pendientes

No hay listado completo de intentos H3; se consulta por actividad/ID autorizado.
Los sobres de envío pendientes viven en memoria hasta abandonar la pantalla.
No se probó generación automática desde prosa porque esa capacidad no existe.
El [contrato propuesto para ML](H4_CONTRATO_GENERACION_ML.md) sigue pendiente de
acuerdo con el responsable; no se modificó su módulo. Tampoco hay respuestas
simuladas de Express/ML, indicadores ficticios o evaluación calculada en frontend.
