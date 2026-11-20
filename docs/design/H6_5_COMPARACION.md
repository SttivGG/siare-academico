# H6-5: comparación visual antes/después

Las capturas before proceden de la imagen H6-4 activa en 3107 antes del despliegue; after procede de H6-5 final `06000f6e`. Se mantienen cuenta sintética, materia y actividades. El cambio de tema no publica credenciales: los campos de contraseña, QR y códigos se enmascaran antes de crear la imagen. Las capturas se toman con las transiciones asentadas.

| Componente | Antes claro / oscuro | Después claro / oscuro | Revisión |
| --- | --- | --- | --- |
| Login | [Claro](evidencias/h6-5/before/login-light.png) / [Oscuro](evidencias/h6-5/before/login-dark.png) | [Claro](evidencias/h6-5/after/login-light.png) / [Oscuro](evidencias/h6-5/after/login-dark.png) | Conserva composición, etiquetas y contraste; estados compartidos de control. |
| Registro | [Claro](evidencias/h6-5/before/registro-light.png) / [Oscuro](evidencias/h6-5/before/registro-dark.png) | [Claro](evidencias/h6-5/after/registro-light.png) / [Oscuro](evidencias/h6-5/after/registro-dark.png) | Conserva validación y jerarquía. |
| Dashboard | [Claro](evidencias/h6-5/before/inicio-light.png) / [Oscuro](evidencias/h6-5/before/inicio-dark.png) | [Claro](evidencias/h6-5/after/inicio-light.png) / [Oscuro](evidencias/h6-5/after/inicio-dark.png) | Rail, encabezado y superficies Nexo conservados. |
| Materias | [Claro](evidencias/h6-5/before/materias-light.png) / [Oscuro](evidencias/h6-5/before/materias-dark.png) | [Claro](evidencias/h6-5/after/materias-light.png) / [Oscuro](evidencias/h6-5/after/materias-dark.png) | Misma lista sintética, sin rutas o datos añadidos para decorar. |
| Cuaderno A | [Claro](evidencias/h6-5/before/cuaderno-light.png) / [Oscuro](evidencias/h6-5/before/cuaderno-dark.png) | [Claro](evidencias/h6-5/after/cuaderno-light.png) / [Oscuro](evidencias/h6-5/after/cuaderno-dark.png) | Selección común de herramienta/panel, centro dominante y laterales conservados. |
| Quiz | [Claro](evidencias/h6-5/before/quiz-seleccion-light.png) / [Oscuro](evidencias/h6-5/before/quiz-seleccion-dark.png) | [Claro](evidencias/h6-5/after/quiz-seleccion-light.png) / [Oscuro](evidencias/h6-5/after/quiz-seleccion-dark.png) | Progreso de respuestas, selección y navegación. La captura no revela una respuesta esperada. |
| Crucigrama | [Claro](evidencias/h6-5/before/crucigrama-pista-light.png) / [Oscuro](evidencias/h6-5/before/crucigrama-pista-dark.png) | [Claro](evidencias/h6-5/after/crucigrama-pista-light.png) / [Oscuro](evidencias/h6-5/after/crucigrama-pista-dark.png) | Palabra y pista actuales relacionadas; foco de celda independiente. |
| Recuperación de acceso | [Claro](evidencias/h6-5/before/recuperacion-light.png) / [Oscuro](evidencias/h6-5/before/recuperacion-dark.png) | [Claro](evidencias/h6-5/after/recuperacion-light.png) / [Oscuro](evidencias/h6-5/after/recuperacion-dark.png) | Mismos campos, respuesta y acciones de recuperación. |
| Seguridad | [Claro](evidencias/h6-5/before/seguridad-light.png) / [Oscuro](evidencias/h6-5/before/seguridad-dark.png) | [Claro](evidencias/h6-5/after/seguridad-light.png) / [Oscuro](evidencias/h6-5/after/seguridad-dark.png) | Cuenta USER sintética sin MFA configurado en estas comparativas; MFA real se prueba por separado con secretos ocultos. |
| Sesiones | [Claro](evidencias/h6-5/before/sesiones-light.png) / [Oscuro](evidencias/h6-5/before/sesiones-dark.png) | [Claro](evidencias/h6-5/after/sesiones-light.png) / [Oscuro](evidencias/h6-5/after/sesiones-dark.png) | Mismo flujo. El conteo puede aumentar al crear la sesión de medición; no es una regresión visual. |
| Administración USER | [Claro](evidencias/h6-5/before/administracion-user-light.png) / [Oscuro](evidencias/h6-5/before/administracion-user-dark.png) | [Claro](evidencias/h6-5/after/administracion-user-light.png) / [Oscuro](evidencias/h6-5/after/administracion-user-dark.png) | Denegación auténtica, sin atribuir permisos ADMIN. |
| Menú móvil | [Claro](evidencias/h6-5/before/menu-movil-light.png) / [Oscuro](evidencias/h6-5/before/menu-movil-dark.png) | [Claro](evidencias/h6-5/after/menu-movil-light.png) / [Oscuro](evidencias/h6-5/after/menu-movil-dark.png) | 375×812; navegación global legible y selección académica visible. El full-page fija las barras en el viewport original. |

Los formularios que no cambiaron de estructura sirven como controles de coherencia de las primitivas compartidas. El foco, la cancelación y la continuidad requieren las pruebas ejecutables; una captura estática no los acredita.

## Administración controlada

| Estado | H6-4 | H6-5 |
| --- | --- | --- |
| ADMIN del ámbito, claro | [Antes](evidencias/h6-4/controlado/admin-ambito-light-1440x900.png) | [Después](evidencias/h6-5/controlled/admin-ambito-light-1440x900.png) |
| ADMIN del ámbito, oscuro | [Antes](evidencias/h6-4/controlado/admin-ambito-dark-1440x900.png) | [Después](evidencias/h6-5/controlled/admin-ambito-dark-1440x900.png) |
| Confirmación, claro | [Antes](evidencias/h6-4/controlado/admin-confirmacion-light-1440x900.png) | [Después](evidencias/h6-5/controlled/admin-confirmacion-light-1440x900.png) |
| SUPERADMIN, oscuro | [Antes](evidencias/h6-4/controlado/superadmin-dark-1440x900.png) | [Después](evidencias/h6-5/controlled/superadmin-dark-1440x900.png) |

Estas capturas usan Next de producción y un upstream HTTP local controlado en ambas fases. No pertenecen a una identidad privilegiada real de Spring ni acreditan permisos administrativos reales. Las confirmaciones H6-4 se conservan.

## Identidad Nexo

Contrasté el resultado con [Nexo claro original](evidencias/h6-0/nexo-claro-original.png), [oscuro](evidencias/h6-0/nexo-oscuro-original.png), [formulario](evidencias/h6-0/nexo-formulario-original.png) y [móvil](evidencias/h6-0/nexo-movil-original.png). Urbanist, naranja con tinta oscura, pasteles cálidos, superficies glass, radios y rail conservan su identidad. El progreso usa el acento legible de la paleta y la pista añade un indicador textual; no se introduce otra paleta.

La revisión visual corrigió el verde de Chromium en el progreso y evitó publicar frames intermedios del cambio de tema. No se cambió el diseño de navegación ni la alternativa A. Las evidencias finales incluyen un manifiesto de integridad y los límites de H6-6 en el [informe](H6_5_INFORME.md).
