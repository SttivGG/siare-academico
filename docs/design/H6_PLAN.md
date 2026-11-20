# Plan H6 — Diseño y desarrollo del frontend SIARE Académico

**Referencia estética:** Nexo Design System, del proyecto Facturación Hexagonal.

**Referencia estructural:** Google NotebookLM, especialmente la organización de fuentes, espacio principal y herramientas.

**Tecnología existente:** Next.js 16, React, TypeScript y Tailwind CSS.

**Objetivo:** transformar la interfaz actual de SIARE en una plataforma académica visualmente coherente, intuitiva, responsive y profesional, preservando todas las funcionalidades existentes.

## Principios fundamentales

1. Mantener a Nexo como identidad visual y utilizar NotebookLM únicamente como referencia de organización.
2. Diseñar primero, validar después e implementar únicamente cuando la propuesta visual esté aprobada.
3. Priorizar la experiencia del estudiante sobre la decoración.
4. Reducir formularios innecesarios, tarjetas repetitivas y espacios desaprovechados.
5. Mantener todos los datos académicos reales. No fabricar métricas, evaluaciones o funcionalidades de ML.
6. No reescribir la aplicación desde cero ni sustituir las integraciones existentes.
7. Separar cada fase mediante entregables, pruebas y puntos de aprobación.

---

## H6-0. Auditoría inicial y adaptación de las skills

**Objetivo:** construir una referencia técnica y visual confiable antes de modificar código.

**Skills:** `ui-ux-pro-max`, `modern-web-guidance` y `dakadesing`.

### Actividades

- Leer íntegramente los tres archivos `SKILL.md` locales indicados por el usuario.
- Identificar procedimientos, dependencias, scripts y restricciones de cada skill.
- Adaptar las instrucciones de DakaDesing que actualmente mencionan Ambrosia.
- No modificar la skill global compartida si puede afectar otros proyectos; crear una adaptación específica del proyecto SIARE.
- Analizar el sistema visual real de Nexo: tokens, tipografías, iconografía, layouts, temas, animaciones, formularios y diálogos.
- Examinar las capturas originales de Nexo, NotebookLM y el frontend actual de SIARE.
- Inventariar todas las pantallas, componentes reutilizables, flujos de navegación y restricciones técnicas de SIARE.
- Identificar problemas de jerarquía, contraste, usabilidad, tamaños, alineación y consistencia.

### Entregables

- `docs/design/H6_AUDITORIA_UX.md`
- `docs/design/H6_REFERENCIAS_NEXO.md`
- `docs/design/H6_SKILLS_SIARE.md`
- Inventario de páginas y componentes.
- Capturas actuales de referencia.
- Lista de problemas priorizada.

**Condición de avance:** auditoría completa, sin cambios ejecutables ni despliegues.

---

## H6-1. Sistema de diseño SIARE basado en Nexo

**Objetivo:** definir un Design System reutilizable que evite estilos inconsistentes entre páginas.

**Skills:** `ui-ux-pro-max`, `dakadesing` y `modern-web-guidance`.

### Elementos

**Colores:** reutilizar la identidad Nexo y crear tokens semánticos de superficie, texto, borde, acento, información, advertencia, éxito y error.

**Tipografía:** Urbanist local, con escalas coherentes para encabezados, párrafos, datos, botones y etiquetas.

**Superficies:** glassmorphism moderado, transparencias controladas, sombras discretas y bordes uniformes.

**Componentes:** botones, campos, selects, tarjetas, diálogos, menús, pestañas, tooltips, listas, buscadores, indicadores de estado y controles de navegación.

**Temas:** claro y oscuro, ambos diseñados y validados, no simplemente invertidos.

**Accesibilidad:** contraste verificable, indicadores de foco, etiquetas semánticas, tamaños táctiles y movimiento reducido.

### Entregables

- Tokens SIARE derivados de Nexo.
- Catálogo de componentes.
- Especificación de estados normal, hover, focus, disabled, loading y error.
- Prototipos claro y oscuro.
- Documento de decisiones visuales.

**Condición de avance:** aprobar la identidad visual antes de aplicarla masivamente.

---

## H6-2. Arquitectura general de navegación

**Objetivo:** construir una estructura de aplicación que aproveche el viewport.

**Skills:** `ui-ux-pro-max`, `modern-web-guidance` y `dakadesing`.

### Distribución

- Barra lateral principal de iconos inspirada en Nexo.
- Encabezado flotante compacto.
- Identidad SIARE y navegación entre secciones.
- Perfil de usuario y acceso a configuración.
- Navegación contextual mediante breadcrumbs.
- Área de contenido flexible.
- Controles de sesión accesibles.

La barra lateral original de Nexo mide 84 px en escritorio, pero esa medida no será obligatoria en todas las resoluciones. Debe convivir con el espacio de trabajo académico sin reducir demasiado el contenido central.

En móviles, utilizar una navegación adaptada al espacio disponible, sin trasladar literalmente la barra de escritorio.

### Entregables

- Prototipo del shell principal.
- Navegación de escritorio, tableta y móvil.
- Temas claro y oscuro.
- Validación por teclado.

**Condición de avance:** aprobar la estructura global.

---

## H6-3. Workspace académico de tres paneles

**Objetivo:** transformar la materia en un verdadero espacio de estudio, con distribución inspirada en NotebookLM.

**Skills:** `ui-ux-pro-max`, `dakadesing` y `modern-web-guidance`.

### Panel izquierdo — Fuentes

- Carga de documentos.
- Búsqueda y orden cronológico.
- Listado compacto con estados reales.
- Selección de material académico.
- Procesamiento, descarga y consulta autorizada.
- Advertencias C2PA y OCR.
- Controles de expansión y contracción.

La carga de archivos debe abrirse bajo demanda, no ocupar permanentemente una sección enorme.

### Panel central — Aprendizaje

Es la zona principal del estudiante.

Estados previstos:

- Bienvenida y contexto de la materia.
- Resumen de fuentes seleccionadas.
- Visualización de contenido documental.
- Resolución de Quiz.
- Resolución de Crucigramas.
- Evaluación y retroalimentación.
- Consulta de resultados.
- Edición avanzada cuando corresponda.

No mostrar valores de rendimiento sin datos reales.

### Panel derecho — Estudio

Acceso compacto a las herramientas disponibles:

- Quiz.
- Crucigramas.
- Catálogo de actividades.
- Consulta de intentos.
- Preparación manual de bancos.
- Funcionalidades futuras identificadas claramente.

Seleccionar una herramienta debe abrir su contenido principal en el panel central.

### Comportamiento adaptable

**Escritorio amplio:** tres paneles simultáneos, con centro dominante.

**Escritorio pequeño/tableta:** panel central prioritario y laterales plegables.

**Móvil:** un panel principal por vez, con navegación clara entre Fuentes, Aprendizaje y Estudio.

Los cambios de panel no deben destruir respuestas, selecciones documentales ni envíos pendientes.

### Entregables

- Prototipos desktop, tablet y móvil.
- Flujo completo de selección de fuente y actividad.
- Definición del comportamiento de paneles.
- Capturas comparativas con NotebookLM.
- Revisión visual antes de pasar a los acabados.

**Condición de avance:** el usuario debe aprobar expresamente la distribución de los tres paneles.

---

## H6-4. Rediseño de las pantallas completas

**Objetivo:** aplicar el mismo lenguaje visual al resto de SIARE.

### Pantallas prioritarias

1. Inicio, acceso y registro.
2. Google/GitLab y autenticación multifactor.
3. Panel inicial del estudiante.
4. Listado de materias.
5. Creación y administración de materias.
6. Espacio de aprendizaje.
7. Documentos académicos.
8. Quiz y Crucigramas.
9. Resultados y retroalimentación.
10. Perfil, seguridad y sesiones.
11. Administración y configuración, respetando permisos.

Priorizar primero las pantallas de mayor uso académico.

### Requisitos

- Formularios compactos y fáciles de completar.
- Jerarquía coherente.
- Mensajes de error comprensibles.
- Diálogos apropiados para confirmaciones.
- Estados vacíos útiles.
- Sin alteraciones de la lógica de negocio.
- Sin nuevos endpoints ficticios.

**Condición de avance:** cada grupo de pantallas debe tener capturas y validación funcional.

---

## H6-5. Animaciones, interacciones y recursos

**Objetivo:** mejorar la sensación de calidad sin perjudicar la productividad.

**Skills principales:** `modern-web-guidance` y `dakadesing`.

**Skills complementarias:** `imagegen`, `media-use`, `hyperframes-creative`, `hyperframes-animation` y `hyperframes-keyframes`.

### Animaciones previstas

- Cambios de panel con transiciones discretas.
- Apertura y cierre de elementos.
- Hover y focus de controles.
- Transiciones de navegación.
- Carga y procesamiento de documentos.
- Avance entre preguntas.
- Retroalimentación de respuestas.
- Aparición de resultados.

Usar CSS o Web Animations API como primera opción. Incorporar GSAP solamente si una interacción requiere una secuencia que justifique la dependencia.

### Recursos visuales

Crear recursos originales cuando sean necesarios: ilustraciones académicas, fondos suaves, patrones o iconografía.

No introducir fotografías decorativas donde interfieran con la lectura ni generar gráficos que aparenten representar datos reales.

### Diálogos

Evaluar SweetAlert2 cuando mejore una interacción concreta. Mantener alternativas semánticas y accesibles mediante elementos nativos si son suficientes.

### Restricciones

- Respetar `prefers-reduced-motion`.
- Evitar animaciones permanentes innecesarias.
- No provocar cambios de layout molestos.
- Optimizar recursos y evitar cargas externas innecesarias.
- Mantener licencias y créditos verificables.

**Condición de avance:** motion y recursos aprobados, sin regresiones de accesibilidad o rendimiento.

---

## H6-6. Pruebas de calidad visual y funcional

**Objetivo:** demostrar que el rediseño mejora la aplicación sin romper sus funcionalidades.

### Matriz de resoluciones

- 1920 × 1080.
- 1440 × 900.
- 1366 × 768.
- 1024 × 768.
- 768 × 1024.
- 390 × 844.
- 375 × 812.
- 320 px de ancho.
- Zoom del navegador al 200 %.

### Validación

- TypeScript y build de Next.js.
- Pruebas unitarias y de componentes.
- Playwright sobre navegadores disponibles.
- Navegación por teclado.
- Contraste y etiquetas accesibles.
- Control de scroll y desbordamientos.
- Tema claro y oscuro.
- Movimiento reducido.
- Rendimiento y tamaño del JavaScript.
- Validación visual mediante capturas reales.

### Regresiones críticas

- Login, sesiones, MFA y OIDC.
- Carga y procesamiento documental.
- Seguridad de archivos en cuarentena.
- Integridad y descarga de PDF con C2PA.
- Selección de documentos READY.
- Creación de actividades H3.
- Quiz y Crucigramas.
- Evaluación Spring e idempotencia.
- Administración y roles.

**Condición de avance:** pruebas satisfactorias y diferencias visuales revisadas.

---

## H6-7. Git, Docker y publicación

**Objetivo:** entregar la versión visual validada sin comprometer la instalación habitual.

### Procedimiento

1. Trabajar desde `main` actualizado en una rama H6 independiente.
2. Preservar los PR #8 y #9 y no incluir accidentalmente Flyway V6.
3. Separar commits por sistema visual, navegación, workspace, componentes y pruebas.
4. Preparar PR con capturas antes/después.
5. Revisar el diff para descartar secretos, archivos privados o modificaciones de otros módulos.
6. Reconstruir exclusivamente la imagen `frontend` cuando corresponda.
7. Recrear selectivamente el contenedor frontend, conservando una imagen anterior para reversión.
8. Comprobar nueve servicios saludables y recorrido real en `http://127.0.0.1:3100`.
9. No eliminar ni recrear volúmenes de las bases de datos.
10. Entregar un informe con commit, imagen, pruebas y limitaciones.

No fusionar automáticamente los PR.

**Criterio de aceptación final:** el usuario debe reconocer la identidad visual de Nexo en toda SIARE, mientras el espacio de estudio ofrece una experiencia de tres paneles organizada, equilibrada y funcional como la referencia de NotebookLM.