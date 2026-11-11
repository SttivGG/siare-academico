[CmdletBinding()]
param([Parameter(Mandatory)][string]$OutputPath)
. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-SiareOwnership
$sql = @'
SELECT 'access', user_id, SHA2(CONCAT_WS('|',user_id,role_name,scope_id,enabled,version),256) FROM user_access ORDER BY user_id;
SELECT 'session', id, SHA2(CONCAT_WS('|',id,user_id,created_at,last_seen_at,idle_expires_at,absolute_expires_at,COALESCE(revoked_at,''),version),256) FROM user_sessions ORDER BY id;
SELECT 'refresh', token_hash, SHA2(CONCAT_WS('|',token_hash,session_id,created_at,COALESCE(consumed_at,'')),256) FROM refresh_tokens ORDER BY token_hash;
SELECT 'audit', id, SHA2(CONCAT_WS('|',id,COALESCE(actor_id,''),operation,resource,occurred_at,outcome,COALESCE(scope_id,'')),256) FROM audit_events ORDER BY id;
'@
$probe = 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql --protocol=TCP -h127.0.0.1 -u"$MYSQL_USER" -D"$MYSQL_DATABASE" --batch --skip-column-names'
$rows = @($sql | & docker compose @script:SiareComposeArgs exec -T mysql sh -ec $probe)
if ($LASTEXITCODE -ne 0) { throw 'No se pudo capturar continuidad de identidad.' }
$rows | ConvertTo-Json | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Host 'OK: huellas de roles, ámbitos asignados, sesiones, refresh y auditoría guardadas sin mostrar credenciales.'
