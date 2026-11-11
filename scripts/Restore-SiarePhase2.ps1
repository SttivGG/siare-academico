[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-SiareDocker
Assert-SiareOwnership
# Back up current state before replacing containers; never replace current data.
$backup = & (Join-Path $PSScriptRoot 'Backup-Siare.ps1')
$legacy = Join-Path $script:SiareRoot 'docker/recovery/compose.fase2.yaml.disabled'
$base = @('--project-name', $script:SiareProject, '--project-directory', $script:SiareRoot, '--env-file', $script:SiareEnv, '--file', $legacy)
& docker compose @base config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Compose de recuperacion invalido.' }
# External to Compose means lifecycle ownership; retain the same physical internal network.
# No down is used, so the shared network and ClickHouse volume remain available.
& docker compose @base up --detach --no-build --wait --wait-timeout 900
if ($LASTEXITCODE -ne 0) { throw 'Recuperacion no completada. El respaldo frio sigue disponible.' }
Write-Host "Fase 2 recuperada sobre los mismos datos y claves. ClickHouse queda detenido. Respaldo previo: $backup"
