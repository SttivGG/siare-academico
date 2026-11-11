[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-SiareDocker
Assert-SiareOwnership
$volumes = @($script:SiareLegacyVolumes | ForEach-Object { "${script:SiareProject}_$_" })
$ch = "${script:SiareProject}_clickhouse-data"
$known = @(& docker volume ls -q --filter "label=com.docker.compose.project=$script:SiareProject")
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron listar volumenes.' }
if ($known -contains $ch) { $volumes += $ch }
foreach ($name in $volumes) { Assert-SiareVolume $name }
# A cold backup avoids inconsistent snapshots of live MySQL, GridFS, AOF and Cassandra files.
$ids = @(Get-SiareContainers)
if ($ids.Count) {
    & docker stop --time 90 @ids | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo detener SIARE limpiamente. No se copian archivos activos.' }
}
Assert-SiareVolumesIdle $volumes
$directory = Join-Path $script:SiareRoot ('.local/backups/' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $directory | Out-Null
Copy-Item -LiteralPath $script:SiareEnv -Destination (Join-Path $directory 'siare.env')
Copy-Item -LiteralPath (Join-Path $script:SiareRoot 'docker/recovery/compose.fase2.yaml.disabled') -Destination $directory
$entries = @()
foreach ($name in $volumes) {
    $file = "$name.tgz"
    & docker run --rm --network none --read-only --mount "type=volume,source=$name,target=/source,readonly" --mount "type=bind,source=$directory,target=/backup" $script:SiareHelperImage sh -ec 'tar -czf "/backup/$1" -C /source .; tar -tzf "/backup/$1" >/dev/null' -- $file
    if ($LASTEXITCODE -ne 0) { throw "Respaldo incompleto: $name. SIARE queda detenido; no migres." }
    $path = Join-Path $directory $file
    $entries += [ordered]@{ volume = $name; archive = $file; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash; bytes = (Get-Item -LiteralPath $path).Length }
    Write-Host "OK respaldo verificado: $name"
}
$manifest = [ordered]@{ project = $script:SiareProject; instance = $script:SiareInstance; createdUtc = [DateTime]::UtcNow.ToString('o'); envSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $directory 'siare.env')).Hash; volumes = $entries }
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $directory 'manifest.json') -Encoding UTF8
Write-Host 'Respaldo frio completo. Contiene credenciales y claves privadas: mantenlo privado y fuera de Git.'
Write-Output $directory
