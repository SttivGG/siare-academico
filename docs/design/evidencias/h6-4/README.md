# Evidencia H6-4

Implementación de la imagen: `cc6cd704a4f93227123afc796f3682315aba862f`. Preview real: http://127.0.0.1:3107. Chromium 157.0.8103.79. Contenido y cuentas sintéticos. Las carpetas `controlado/` usan un upstream HTTP de prueba: sus roles y operaciones no son autorización privilegiada real.

Los PNG sensibles se escriben con máscaras para contraseñas, semillas, QR y códigos MFA. No se publican tokens ni originales documentales. Las capturas académicas utilizan PDF sintético.

| Caso | Claro | Oscuro |
| --- | --- | --- |
| R01 · / | [PNG](rutas/R01-light-1440x900.png) | [PNG](rutas/R01-dark-1440x900.png) |
| R02 · /login | [PNG](rutas/R02-light-1440x900.png) | [PNG](rutas/R02-dark-1440x900.png) |
| R03 · /registro | [PNG](rutas/R03-light-1440x900.png) | [PNG](rutas/R03-dark-1440x900.png) |
| R04 · /recuperar | [PNG](rutas/R04-light-1440x900.png) | [PNG](rutas/R04-dark-1440x900.png) |
| R05 · /recuperar/confirmar | [PNG](rutas/R05-light-1440x900.png) | [PNG](rutas/R05-dark-1440x900.png) |
| R06 · /login/mfa | [PNG](rutas/R06-light-1440x900.png) | [PNG](rutas/R06-dark-1440x900.png) |
| R07 · /sesion/renovar | [PNG](rutas/R07-light-1440x900.png) | [PNG](rutas/R07-dark-1440x900.png) |
| R08 · /inicio | [PNG](rutas/R08-light-1440x900.png) | [PNG](rutas/R08-dark-1440x900.png) |
| R09 · /materias | [PNG](rutas/R09-light-1440x900.png) | [PNG](rutas/R09-dark-1440x900.png) |
| R10 · /materias/nueva | [PNG](rutas/R10-light-1440x900.png) | [PNG](rutas/R10-dark-1440x900.png) |
| R11 · /materias/[id] | [PNG](rutas/R11-light-1440x900.png) | [PNG](rutas/R11-dark-1440x900.png) |
| R12 · /seguridad | [PNG](rutas/R12-light-1440x900.png) | [PNG](rutas/R12-dark-1440x900.png) |
| R13 · /sesiones | [PNG](rutas/R13-light-1440x900.png) | [PNG](rutas/R13-dark-1440x900.png) |
| R14 · /administracion | [PNG](controlado/superadmin-light-1440x900.png) | [PNG](controlado/superadmin-dark-1440x900.png) |
| A01 · Login: credenciales erróneas y errores de campo | [PNG](real/A01-error-real-light-1440x900.png) | [PNG](real/A01-error-real-dark-1440x900.png) |
| A02 · Login: registro completado / sesión caducada | [PNG](real/A02-sesion-expirada-light-1440x900.png) | [PNG](real/A02-sesion-expirada-dark-1440x900.png) |
| A03 · Google y GitLab: disponibilidad, cancelación, error y vínculo requerido | [PNG](real/A03-contexto-light-1440x900.png) | [PNG](real/A03-contexto-dark-1440x900.png) |
| A04 · MFA: desafío, código offline y configuración requerida | [PNG](real/A04-desafio-real-light-1440x900.png) | [PNG](real/A04-desafio-real-dark-1440x900.png) |
| A05 · Recuperación: solicitud / token ausente, inválido o expirado | [PNG](real/A05-solicitud-light-1440x900.png) | [PNG](real/A05-solicitud-dark-1440x900.png) |
| W01 · Materia: bienvenida, carga, error y no disponible | [PNG](estados-academicos/materia-error-controlado-light-1440x900.png) | [PNG](estados-academicos/materia-error-controlado-dark-1440x900.png) |
| W02 · Fuentes: listado, búsqueda y selección única | [PNG](academico/desktop/documento-seleccionado-light-1440x900.png) | [PNG](academico/desktop/documento-seleccionado-dark-1440x900.png) |
| W03 · Fuentes: cargar archivo y progreso | [PNG](estados-academicos/documento-carga-en-curso-light-1440x900.png) | [PNG](estados-academicos/documento-carga-en-curso-dark-1440x900.png) |
| W04 · Fuentes: cuarentena, PROCESSING, READY, FAILED y lease | [PNG](estados-academicos/documento-cuarentena-light-1440x900.png) | [PNG](estados-academicos/documento-cuarentena-dark-1440x900.png) |
| W05 · Lectura documental, C2PA y OCR | [PNG](academico/desktop/lectura-light-1440x900.png) | [PNG](academico/desktop/lectura-dark-1440x900.png) |
| W06 · Catálogo y paginación | [PNG](estados-academicos/catalogo-real-light-1440x900.png) | [PNG](estados-academicos/catalogo-real-dark-1440x900.png) |
| W07 · Preparar/importar/validar/revisar/publicar banco | [PNG](academico/desktop/banco-revision-light-1440x900.png) | [PNG](academico/desktop/banco-revision-dark-1440x900.png) |
| W08 · Quiz central | [PNG](academico/desktop/quiz-light-1440x900.png) | [PNG](academico/desktop/quiz-dark-1440x900.png) |
| W09 · Crucigrama central | [PNG](academico/desktop/crucigrama-light-1440x900.png) | [PNG](academico/desktop/crucigrama-dark-1440x900.png) |
| W10 · Envío en curso, timeout y respuesta perdida | [PNG](estados-academicos/envio-pendiente-respuesta-real-light-1440x900.png) | [PNG](estados-academicos/envio-pendiente-respuesta-real-dark-1440x900.png) |
| W11 · Resultado y retroalimentación | [PNG](academico/desktop/evaluacion-light-1440x900.png) | [PNG](academico/desktop/evaluacion-dark-1440x900.png) |
| W12 · Consulta de intento y enlace directo | [PNG](estados-academicos/consulta-intento-light-1440x900.png) | [PNG](estados-academicos/consulta-intento-dark-1440x900.png) |
| W13 · Editar, confirmar/cancelar archivo y materia archivada | [PNG](estados-academicos/materia-archivada-light-1440x900.png) | [PNG](estados-academicos/materia-archivada-dark-1440x900.png) |
| W14 · Recarga, retorno a materia, sesión expirada y cambio de cuenta | [PNG](academico/desktop/recuperacion-light-1440x900.png) | [PNG](academico/desktop/recuperacion-dark-1440x900.png) |
| I01 · Resumen de perfil y menú de cuenta | [PNG](rutas/I01-light-1440x900.png) | [PNG](rutas/I01-dark-1440x900.png) |
| I02 · Seguridad: estado MFA, QR, confirmación y códigos | [PNG](real/I02-enrolamiento-oculto-light-1440x900.png) | [PNG](real/I02-enrolamiento-oculto-dark-1440x900.png) |
| I03 · Seguridad: desactivar MFA, renovar códigos y reautenticar | [PNG](controlado/mfa-desactivar-confirmacion-light-1440x900.png) | [PNG](controlado/mfa-desactivar-confirmacion-dark-1440x900.png) |
| I04 · Identidades vinculadas, vincular y desconectar | [PNG](controlado/desconectar-identidad-light-1440x900.png) | [PNG](controlado/desconectar-identidad-dark-1440x900.png) |
| I05 · Sesiones: una, otras y todas; error/cancelación | [PNG](real/I05-confirmar-sesion-light-1440x900.png) | [PNG](real/I05-confirmar-sesion-dark-1440x900.png) |
| I06 · Preferencia claro / oscuro / sistema | [PNG](rutas/R02-light-1440x900.png) | [PNG](rutas/R02-dark-1440x900.png) |
| D01 · Administración: USER o MFA/autorización insuficiente | [PNG](rutas/R14-light-1440x900.png) | [PNG](rutas/R14-dark-1440x900.png) |
| D02 · Administración: ADMIN dentro de ámbito | [PNG](controlado/admin-ambito-light-1440x900.png) | [PNG](controlado/admin-ambito-dark-1440x900.png) |
| D03 · Administración: SUPERADMIN, roles y ámbitos | [PNG](controlado/superadmin-light-1440x900.png) | [PNG](controlado/superadmin-dark-1440x900.png) |
| D04 · Administración: crear ámbito y registro público | [PNG](controlado/registro-conflicto-light-1440x900.png) | [PNG](controlado/registro-conflicto-dark-1440x900.png) |
| D05 · Administración: auditoría reciente, vacío y error | [PNG](controlado/auditoria-error-light-1440x900.png) | [PNG](controlado/auditoria-error-dark-1440x900.png) |
| X01 · Error inesperado y recuperación | [PNG](controlado/error-inesperado-light-1440x900.png) | [PNG](controlado/error-inesperado-dark-1440x900.png) |
| X02 · Página inexistente | [PNG](rutas/X02-light-1440x900.png) | [PNG](rutas/X02-dark-1440x900.png) |
| X03 · Loading de sesiones y de administración | [PNG](controlado/administracion-carga-light-1440x900.png) | [PNG](controlado/administracion-carga-dark-1440x900.png) |
| X04 · Shell, menú contextual y navegación móvil | [PNG](rutas/X04-menu-light-390x844.png) | [PNG](rutas/X04-menu-dark-390x844.png) |
| X05 · Diálogos, menús, tooltips y confirmaciones | [PNG](controlado/admin-confirmacion-light-1440x900.png) | [PNG](controlado/admin-confirmacion-dark-1440x900.png) |
| X06 · Botones, campos, selectores, listas/tablas y estados | [PNG](controlado/login-error-campo-light-1440x900.png) | [PNG](controlado/login-error-campo-dark-1440x900.png) |

## Estados adicionales

| Origen | Estado | Claro 1440 | Oscuro 1440 |
| --- | --- | --- | --- |
| controlado | admin-ambito | [PNG](controlado/admin-ambito-light-1440x900.png) | [PNG](controlado/admin-ambito-dark-1440x900.png) |
| controlado | admin-confirmacion | [PNG](controlado/admin-confirmacion-light-1440x900.png) | [PNG](controlado/admin-confirmacion-dark-1440x900.png) |
| controlado | administracion-carga | [PNG](controlado/administracion-carga-light-1440x900.png) | [PNG](controlado/administracion-carga-dark-1440x900.png) |
| controlado | administracion-denegada | [PNG](controlado/administracion-denegada-light-1440x900.png) | [PNG](controlado/administracion-denegada-dark-1440x900.png) |
| controlado | administracion-error | [PNG](controlado/administracion-error-light-1440x900.png) | [PNG](controlado/administracion-error-dark-1440x900.png) |
| controlado | administracion-vacia | [PNG](controlado/administracion-vacia-light-1440x900.png) | [PNG](controlado/administracion-vacia-dark-1440x900.png) |
| controlado | auditoria-error | [PNG](controlado/auditoria-error-light-1440x900.png) | [PNG](controlado/auditoria-error-dark-1440x900.png) |
| controlado | conflicto-version | [PNG](controlado/conflicto-version-light-1440x900.png) | [PNG](controlado/conflicto-version-dark-1440x900.png) |
| controlado | desconectar-identidad | [PNG](controlado/desconectar-identidad-light-1440x900.png) | [PNG](controlado/desconectar-identidad-dark-1440x900.png) |
| controlado | error-inesperado | [PNG](controlado/error-inesperado-light-1440x900.png) | [PNG](controlado/error-inesperado-dark-1440x900.png) |
| controlado | identidad-protegida | [PNG](controlado/identidad-protegida-light-1440x900.png) | [PNG](controlado/identidad-protegida-dark-1440x900.png) |
| controlado | login-error-campo | [PNG](controlado/login-error-campo-light-1440x900.png) | [PNG](controlado/login-error-campo-dark-1440x900.png) |
| controlado | mfa-configuracion-requerida | [PNG](controlado/mfa-configuracion-requerida-light-1440x900.png) | [PNG](controlado/mfa-configuracion-requerida-dark-1440x900.png) |
| controlado | mfa-desactivar-confirmacion | [PNG](controlado/mfa-desactivar-confirmacion-light-1440x900.png) | [PNG](controlado/mfa-desactivar-confirmacion-dark-1440x900.png) |
| controlado | mfa-error-reautenticacion | [PNG](controlado/mfa-error-reautenticacion-light-1440x900.png) | [PNG](controlado/mfa-error-reautenticacion-dark-1440x900.png) |
| controlado | mfa-expirada | [PNG](controlado/mfa-expirada-light-1440x900.png) | [PNG](controlado/mfa-expirada-dark-1440x900.png) |
| controlado | mfa-recuperacion | [PNG](controlado/mfa-recuperacion-light-1440x900.png) | [PNG](controlado/mfa-recuperacion-dark-1440x900.png) |
| controlado | portada-servicio-no-disponible | [PNG](controlado/portada-servicio-no-disponible-light-1440x900.png) | [PNG](controlado/portada-servicio-no-disponible-dark-1440x900.png) |
| controlado | recuperacion-invalida | [PNG](controlado/recuperacion-invalida-light-1440x900.png) | [PNG](controlado/recuperacion-invalida-dark-1440x900.png) |
| controlado | registro-cerrado | [PNG](controlado/registro-cerrado-light-1440x900.png) | [PNG](controlado/registro-cerrado-dark-1440x900.png) |
| controlado | registro-conflicto | [PNG](controlado/registro-conflicto-light-1440x900.png) | [PNG](controlado/registro-conflicto-dark-1440x900.png) |
| controlado | seguridad-activa | [PNG](controlado/seguridad-activa-light-1440x900.png) | [PNG](controlado/seguridad-activa-dark-1440x900.png) |
| controlado | sesiones-carga | [PNG](controlado/sesiones-carga-light-1440x900.png) | [PNG](controlado/sesiones-carga-dark-1440x900.png) |
| controlado | sesiones-error | [PNG](controlado/sesiones-error-light-1440x900.png) | [PNG](controlado/sesiones-error-dark-1440x900.png) |
| controlado | sesiones-lista | [PNG](controlado/sesiones-lista-light-1440x900.png) | [PNG](controlado/sesiones-lista-dark-1440x900.png) |
| controlado | sesiones-vacias | [PNG](controlado/sesiones-vacias-light-1440x900.png) | [PNG](controlado/sesiones-vacias-dark-1440x900.png) |
| controlado | superadmin | [PNG](controlado/superadmin-light-1440x900.png) | [PNG](controlado/superadmin-dark-1440x900.png) |
| estados-academicos | archivo-confirmacion | [PNG](estados-academicos/archivo-confirmacion-light-1440x900.png) | [PNG](estados-academicos/archivo-confirmacion-dark-1440x900.png) |
| estados-academicos | catalogo-real | [PNG](estados-academicos/catalogo-real-light-1440x900.png) | [PNG](estados-academicos/catalogo-real-dark-1440x900.png) |
| estados-academicos | consulta-intento | [PNG](estados-academicos/consulta-intento-light-1440x900.png) | [PNG](estados-academicos/consulta-intento-dark-1440x900.png) |
| estados-academicos | documento-carga-en-curso | [PNG](estados-academicos/documento-carga-en-curso-light-1440x900.png) | [PNG](estados-academicos/documento-carga-en-curso-dark-1440x900.png) |
| estados-academicos | documento-cuarentena | [PNG](estados-academicos/documento-cuarentena-light-1440x900.png) | [PNG](estados-academicos/documento-cuarentena-dark-1440x900.png) |
| estados-academicos | documento-procesar-pendiente | [PNG](estados-academicos/documento-procesar-pendiente-light-1440x900.png) | [PNG](estados-academicos/documento-procesar-pendiente-dark-1440x900.png) |
| estados-academicos | documento-seleccionado-para-carga | [PNG](estados-academicos/documento-seleccionado-para-carga-light-1440x900.png) | [PNG](estados-academicos/documento-seleccionado-para-carga-dark-1440x900.png) |
| estados-academicos | envio-pendiente-respuesta-real | [PNG](estados-academicos/envio-pendiente-respuesta-real-light-1440x900.png) | [PNG](estados-academicos/envio-pendiente-respuesta-real-dark-1440x900.png) |
| estados-academicos | lectura-real | [PNG](estados-academicos/lectura-real-light-1440x900.png) | [PNG](estados-academicos/lectura-real-dark-1440x900.png) |
| estados-academicos | materia-archivada | [PNG](estados-academicos/materia-archivada-light-1440x900.png) | [PNG](estados-academicos/materia-archivada-dark-1440x900.png) |
| estados-academicos | materia-carga | [PNG](estados-academicos/materia-carga-light-1440x900.png) | [PNG](estados-academicos/materia-carga-dark-1440x900.png) |
| estados-academicos | materia-error-controlado | [PNG](estados-academicos/materia-error-controlado-light-1440x900.png) | [PNG](estados-academicos/materia-error-controlado-dark-1440x900.png) |

[Pruebas por caso](pruebas.json), [runtime y preservación](runtime.json), [rutas y geometría](rutas/validacion.json), [estados controlados](controlado/validation.json), [estados académicos](estados-academicos/validation.json), [matriz académica de escritorio](academico/desktop/validacion.json), [contexto móvil](academico/mobile/validacion.json), [humo 3100 e intento de zoom](habitual-browser-zoom.json).

Los nombres de los PNG académicos incluyen los ocho tamaños. Los screenshots de carga transitoria no acreditan toda la matriz; la fila X03 mantiene ese pendiente. El escalado de fuente del test académico es adicional y no equivale a zoom del navegador.
