# Verificación final de despliegue

Toda tarea de desarrollo debe cerrar con una verificación de despliegue. Si el
cambio afecta código ejecutado en contenedores, identificar primero el proyecto
Compose y las imágenes realmente activas; reconstruir y recrear únicamente los
servicios necesarios para que la instalación habitual muestre el cambio. Validar
salud y comportamiento en http://127.0.0.1:3100, incluido navegador cuando cambie
la interfaz. Compilar una imagen de prueba no acredita el despliegue.

Usar la configuración y controles oficiales, conservar una imagen funcional para
reversión, esperar healthy y registrar rama, commit, imágenes, contenedores y
pruebas. Los cambios únicamente documentales no necesitan despliegue.

Preservar cambios ajenos, historial de main, responsabilidades del equipo, .env,
claves MFA/JWT, credenciales, redes y volúmenes persistentes. No fusionar PR públicos
sin autorización. Priorizar despliegues selectivos, con --no-deps cuando proceda;
no usar limpieza destructiva ni eliminar datos para resolver un despliegue.
