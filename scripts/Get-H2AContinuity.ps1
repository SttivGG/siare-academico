[CmdletBinding()]
param([Parameter(Mandatory)][string]$OutputPath)
. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-SiareDocker
Assert-SiareOwnership
$sql = @'
SELECT 'user', id, SHA2(CONCAT_WS('|',id,name,email,password_hash,created_at),256) FROM users ORDER BY id;
SELECT 'subject', id, SHA2(CONCAT_WS('|',id,user_id,name,COALESCE(description,''),archived,created_at,updated_at),256) FROM subjects ORDER BY id;
'@
$probe = 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql --protocol=TCP -h127.0.0.1 -u"$MYSQL_USER" -D"$MYSQL_DATABASE" --batch --skip-column-names'
$rows = @($sql | & docker compose @script:SiareComposeArgs exec -T mysql sh -ec $probe)
if ($LASTEXITCODE -ne 0) { throw 'No se pudo obtener continuidad MySQL.' }
$statePath = Join-Path $script:SiareRoot '.cache/h2a-engines-snapshot.json'
& (Join-Path $PSScriptRoot 'Get-SiarePersistence.ps1') -OutputPath $statePath
$engines = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
[ordered]@{ rows=$rows; mongo=$engines.mongo; keys=$engines.keys; mounts=$engines.mounts; envSha256=(Get-FileHash -LiteralPath $script:SiareEnv -Algorithm SHA256).Hash } |
    ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Host 'OK: huellas de todos los usuarios/materias, MongoDB, RSA, montajes y .env guardadas sin mostrar credenciales.'
