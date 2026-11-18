[CmdletBinding()]
param([Parameter(Mandatory)][string]$BackupPath,
    [Parameter(Mandatory)][ValidatePattern('^[a-z0-9][a-z0-9_-]+$')][string]$RecoveryProject)
. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-SiareDocker
Assert-SiareOwnership
if ($RecoveryProject -eq $script:SiareProject) { throw 'La restauracion de archivos solo admite un proyecto nuevo; no sobrescribe datos existentes.' }
$directory = (Resolve-Path -LiteralPath $BackupPath).Path
$manifest = Get-Content -LiteralPath (Join-Path $directory 'manifest.json') -Raw | ConvertFrom-Json
if ($manifest.project -ne $script:SiareProject -or $manifest.instance -ne $script:SiareInstance) { throw 'Respaldo de otra instancia.' }
$archiveVolumes = @($manifest.volumes | ForEach-Object { $_.volume })
if (@($archiveVolumes | Sort-Object -Unique).Count -ne $archiveVolumes.Count) { throw 'El manifiesto contiene volumenes duplicados.' }
foreach ($suffix in $script:SiareLegacyVolumes) {
    if ($archiveVolumes -notcontains "${script:SiareProject}_$suffix") { throw "Respaldo incompleto: falta $suffix." }
}
$targets = @()
foreach ($entry in $manifest.volumes) {
    if ($entry.volume -notmatch ('^' + [regex]::Escape($script:SiareProject) + '_(mysql-data|mongo-data|mongo-config|cassandra-data|redis-data|jwt-keys|clickhouse-data)$') -or $entry.archive -ne "$($entry.volume).tgz") { throw 'Manifiesto contiene rutas o volumenes no permitidos.' }
    $archive = Join-Path $directory $entry.archive
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash -ne $entry.sha256) { throw "SHA-256 no coincide: $($entry.archive)" }
    $target = $RecoveryProject + $entry.volume.Substring($script:SiareProject.Length)
    $targets += $target
}
if ((Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $directory 'siare.env')).Hash -ne $manifest.envSha256) { throw 'SHA-256 de credenciales no coincide.' }
$existing = @(& docker volume ls -q)
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron listar destinos.' }
if (@($targets | Where-Object { $existing -contains $_ }).Count) { throw 'Un destino ya existe. Elige otro RecoveryProject; no se sobrescribe.' }
if (@(& docker ps -aq --filter "label=com.docker.compose.project=$RecoveryProject").Count) { throw 'El proyecto de recuperacion ya tiene contenedores.' }
for ($i = 0; $i -lt $targets.Count; $i++) {
    $target = $targets[$i]
    $file = $manifest.volumes[$i].archive
    & docker volume create --label "com.docker.compose.project=$RecoveryProject" --label "io.siare.instance=$script:SiareInstance" $target | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear destino de recuperacion.' }
    & docker run --rm --network none --read-only --mount "type=volume,source=$target,target=/target" --mount "type=bind,source=$directory,target=/backup,readonly" $script:SiareHelperImage sh -ec 'tar -xzf "/backup/$1" -C /target; tar -tzf "/backup/$1" >/dev/null' -- $file
    if ($LASTEXITCODE -ne 0) { throw "Restauracion incompleta: $target. El origen permanece intacto." }
    # GNU tar compares every restored file's bytes, ownership and mode to the archive.
    & docker run --rm --network none --read-only --mount "type=volume,source=$target,target=/target,readonly" --mount "type=bind,source=$directory,target=/backup,readonly" node:24.22.2-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 sh -ec 'tar --compare --gzip --file "/backup/$1" --directory /target' -- $file
    if ($LASTEXITCODE -ne 0) { throw "La comparacion de archivos restaurados fallo: $target." }
    Write-Host "OK restaurado: $target"
}
$envContent = [IO.File]::ReadAllText((Join-Path $directory 'siare.env'))
$envContent = [regex]::Replace($envContent, '(?m)^COMPOSE_PROJECT_NAME=[^\r\n]+', "COMPOSE_PROJECT_NAME=$RecoveryProject")
$recoveryEnv = Join-Path $directory "$RecoveryProject.env"
[IO.File]::WriteAllText($recoveryEnv, $envContent, (New-Object Text.UTF8Encoding($false)))
Write-Host "Restauracion aislada completa. Env privado: $recoveryEnv. No se arrancaron servidores ni se modificaron puertos."
