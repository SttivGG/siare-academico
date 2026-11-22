# H6: cristal compartido de SIARE

La homologación parte de `feat/h6-landing-access` en `123cc0b`, que conserva
H6-2, H6-3, H6-4, H6-5 y los ajustes posteriores de logo y acceso. El worktree
de origen estaba limpio. La rama de trabajo es `feat/h6-sorvo-global`.

La [demo Sorvo](https://demo.codeandchill.store/sorvo/#/home) se abrió en Chromium
y se capturó en claro y oscuro. Se tomaron como referencia sus superficies
translúcidas, reflejos superiores, bordes finos, sombras y navegación flotante.
Los archivos de la demo se usan solo como capturas comparativas de documentación;
el producto conserva su fotografía, PNG, Urbanist y naranja `#F58136`.

## Superficies

`frontend/src/styles/tokens.css` define el sistema. Los componentes existentes
consumen sus variantes sin alterar el árbol React ni los controladores académicos.

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `--glass-primary` | Blanco al 28% | Carbón al 28% | Landing, dashboard, materias, tres paneles, seguridad y administración |
| `--glass-secondary` | Blanco al 20% | Carbón al 20% | Listas y secciones interiores sin blur adicional |
| `--glass-navigation` | Blanco al 56% | Carbón al 56% | Rail, cabecera, controles móviles y pie de acceso |
| `--glass-form` | Blanco al 38% | Carbón al 36% | Campos y controles |
| `--glass-reading` | Neutro al 91% | Neutro al 91% | Lectura, banco, actividad, resultado y mensajes de texto |
| `--glass-modal` | Neutro al 86% | Neutro al 86% | Diálogo nativo y menús |

El tinte principal transmite la fotografía. `--glass-paint` añade un reflejo
diagonal; `--shadow` combina reflejos interiores y sombra exterior. El blur es
de 10 px en paneles y 12 px en navegación. Campos, lectores, editores y filas
no reciben filtros propios. Los paneles anidados evitan apilar desenfoques.

Los colores de estado conservan fondos de mayor contraste. Las notas cromáticas
secundarias usan alpha, sin convertir los paneles en tarjetas de color sólido.
La fotografía permanece a color bajo un velo lateral neutro. No se usa
`grayscale()`, sepia ni una capa marrón. La madera conserva su color original.

## Tema y accesibilidad

Los tokens declaran valores explícitos para claro y oscuro y siguen el sistema
cuando no hay una preferencia guardada. El tema explícito tiene precedencia.
El sistema global funciona sin depender de `light-dark()`.

El fallback sin `backdrop-filter` usa `--glass-fallback` legible en todos los
roles de superficie. Comprueba tanto la propiedad estándar como la prefijada.
Los selectores del fallback tienen la misma especificidad que los selectores de
tema; así también cubren oscuro y sistema. `prefers-reduced-transparency`
retira transparencia y blur; los colores forzados usan los colores del sistema.
Se conservan las reglas de movimiento reducido, foco y controles de 44 px.

Se mantiene **Fuentes | Aprendizaje | Estudio**, incluidos los slots montados,
el selector móvil y los borradores por fuente. Los cambios productivos de este
encargo se limitan a CSS: no cambian peticiones, efectos, permisos ni evaluación.

## Consultas técnicas

Se consultaron `ui-ux-pro-max`, `modern-web-guidance` y DakaDesing con la
[adaptación SIARE](https://github.com/SttivGG/siare-academico/blob/597d045f8bcdbc14a2e68f4d7d8cdc435267c98f/docs/design/H6_SKILLS_SIARE.md). Sorvo sustituye la referencia estética
anterior; permanecen las decisiones académicas aprobadas. La propuesta genérica
de UI UX devolvió Fira y verde de dashboard: se descartaron para conservar
Urbanist y el naranja institucional.

Se aplicó la guía `visual-effects`: interpolación `in oklab` para neutros y un
preámbulo de gradiente válido cuando no se admite ese espacio. La regla consultada
indica: “Avoid using `in oklch` for alpha transparency fades or mixing neutral colors.”
Se verificó también la necesidad de transparencia para percibir el filtro en
[MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter).

De [claude-webkit/frontend-design](https://github.com/Hainrixz/claude-webkit/blob/main/.claude/skills/frontend-design/SKILL.md)
se tomó la revisión de jerarquía y componentes reales. El brief de SIARE prevalece
sobre sus preferencias genéricas de paleta y decoraciones. `building-components`
no pudo recuperarse y no se considera consultado. Se conserva el diálogo nativo
compartido; la adaptación no obliga a instalar SweetAlert2.

La validación, comparación y límites se registran en [el informe](https://github.com/SttivGG/siare-academico/blob/597d045f8bcdbc14a2e68f4d7d8cdc435267c98f/docs/design/H6_SORVO_INFORME.md).


## Extensión: navegación y Apariencia

La [extensión de Apariencia](https://github.com/SttivGG/siare-academico/blob/597d045f8bcdbc14a2e68f4d7d8cdc435267c98f/docs/design/H6_APARIENCIA_INFORME.md) añade la ruta protegida `/configuracion/apariencia`. El rail ahora toca x=0 y ocupa 100dvh, con anchos compartidos de 72/232 px; el encabezado mide 56 px y conserva únicamente el tema rápido. La cuenta vive en el extremo inferior de la navegación. En móvil la navegación se despliega bajo el encabezado sin reservar una columna de escritorio.

`--appearance-opacity` alimenta los tokens semánticos primario, secundario y navegación; no sustituye las reglas de accesibilidad. La transparencia se limita a 20–72% (opacidad primaria 80–28%). Navegación conserva al menos 56% de opacidad; lectura 91% y modales 86% no disminuyen. El blur predeterminado sigue en 10 px (navegación 12 px); el control acepta 0–24 px, con navegación limitada a 24. El velo conserva los neutros H6 y ajusta su alpha dentro de límites; su valor 50 restaura el tratamiento aprobado. No se aplican filtros de color.

`appearance-store` es el único almacén en memoria de las preferencias. Conserva `siare-theme` como única clave persistente del tema existente; las demás preferencias usan `siare-appearance-v1` con versión, valores acotados y fondos autorizados. Ninguna clave visual contiene identidad, tokens ni secretos. El script previo al pintado comparte el normalizador con el runtime y funciona tras minificación de producción. `AppearanceSync` escucha en el layout raíz, también en páginas públicas y errores, sin envolver ni dar claves a los componentes académicos.
