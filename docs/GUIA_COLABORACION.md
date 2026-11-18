# Colaboración en SIARE Académico

La base compartida es `origin/main`. El compañero desarrolla la aplicación React Native en `mobile/`, con su propia cuenta GitHub. No se entrega una implementación móvil en esta consolidación.

```powershell
git clone https://github.com/SttivGG/siare-academico.git
cd siare-academico
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/mobile-react-native origin/main
# Después de crear y verificar cambios propios:
git add mobile
git commit -m "feat(mobile): add initial React Native client"
git push -u origin feature/mobile-react-native
```

Si ya tiene el repositorio, conserve primero sus cambios con commits en su rama. No use `reset --hard`, checkout destructivo ni limpieza global. Si la rama móvil ya existe, cambie a ella sin volver a crearla ni sobrescribirla. El texto de commit anterior es un ejemplo para cuando haya implementación real.

## Pull requests y actualización

Los PR se dirigen a `main`, describen problema, comportamiento, pruebas y pendientes. Requieren revisión de un compañero antes de fusionar. Priorizar merge commits para conservar trazabilidad académica y no borrar ramas. No usar force push ni desactivar protecciones de GitHub. La regla de revisión del equipo aplica aunque el repositorio no la imponga técnicamente.

Para incorporar avances compartidos en una rama con árbol limpio:

```powershell
git fetch origin
git switch feature/mobile-react-native
git merge origin/main
# Si hay conflictos: revisar cada archivo, resolver, añadir y confirmar el merge.
git diff --check
git push
```

No elija `ours`/`theirs` globalmente. Preserve lógica de sesión, roles, MFA, materias y documentos y repita pruebas afectadas. Cambios backend del contrato móvil deben coordinarse en PR con su OpenAPI y documentación; no modificar migraciones Flyway ya aplicadas. Use una migración nueva y preserve datos, claves RSA/AES, nombres de volúmenes e identidad local.

## Verificación antes de revisar

- Lea [onboarding](ONBOARDING_MOBILE.md) y [contrato móvil](CONTRATO_API_MOBILE.md); distinga rutas entregadas de adaptaciones pendientes.
- Ejecute `git diff --check`, revise `git diff --cached` y compruebe que el commit solo contiene archivos previstos.
- Ejecute pruebas relevantes del componente y las regresiones backend si cambia el contrato. Los comandos actuales están en onboarding; las pruebas de móvil se incorporarán con su proyecto.
- Mantenga `.env` y credenciales fuera de Git; `.env.example` solo usa valores ficticios o secretos vacíos. No comparta respaldos, volúmenes, RSA, AES, semillas TOTP, JWT ni refresh reales.
- Compruebe Android emulador y teléfono cuando exista el cliente. No acepte TLS inválido ni reutilice cookies del BFF. Documente pruebas controladas y externas por separado.

Mantenga los commits a nombre de su autor real. Cada desarrollador aprovisiona sus secretos locales y usa su cuenta GitHub; no se comparten credenciales. Los cambios documentales posteriores a una integración también pasan por PR. No crear un tag final de entrega sin una instrucción posterior.
