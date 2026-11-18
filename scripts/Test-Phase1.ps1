[CmdletBinding()]
param([switch]$RestartContainers)

. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-SiareDocker
Assert-SiareOwnership
Invoke-SiareCompose config --quiet
$sql = 'SELECT COUNT(*) FROM flyway_schema_history WHERE version = ''1'' AND success = 1; SELECT COUNT(*) FROM users u WHERE password_hash NOT LIKE ''$2a$12$%'' AND password_hash NOT LIKE ''$2b$12$%'' AND password_hash NOT LIKE ''$argon2id$%'' AND NOT (password_hash = ''!OIDC'' AND EXISTS (SELECT 1 FROM external_identities e WHERE e.user_id = u.id));'
$probe = @'
MYSQL_PWD="$MYSQL_PASSWORD" exec mysql --protocol=TCP -h127.0.0.1 -u"$MYSQL_USER" -D"$MYSQL_DATABASE" --batch --skip-column-names
'@
$schema = @($sql | & docker compose @script:SiareComposeArgs exec -T mysql sh -ec $probe)
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar el esquema MySQL.' }
if ($schema.Count -ne 2 -or $schema[0] -ne '1' -or $schema[1] -ne '0') { throw 'La migracion V1 o los hashes de contrasena no son correctos.' }
Write-Host 'OK: Flyway V1 conservada en MySQL; hashes BCrypt/Argon2id y cuentas sin contraseña con identidad externa admitidos (sin mostrar credenciales).'
if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw 'Esta prueba necesita Node.js 24 en el host.' }
$testArgs = @((Join-Path $PSScriptRoot 'test-phase1.mjs'))
if ($RestartContainers) { $testArgs += '--restart' }
& node @testArgs
if ($LASTEXITCODE -ne 0) { throw 'Fallo la verificacion real de la fase 1.' }
& (Join-Path $PSScriptRoot 'Test-Siare.ps1')
