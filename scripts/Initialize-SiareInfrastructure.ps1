[CmdletBinding()]
param([switch]$NewInstallation)
. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-SiareDocker
Assert-SiareOwnership
$existing = @(& docker volume ls -q --filter "label=com.docker.compose.project=$script:SiareProject")
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron listar los volumenes.' }
if ($NewInstallation -and (@(Get-SiareContainers).Count -gt 0 -or $existing.Count -gt 0)) {
    throw 'NewInstallation solo admite un proyecto sin contenedores ni volumenes previos.'
}
$existing = @(& docker volume ls -q)
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron comprobar colisiones de nombres.' }
# A volume with the expected name but different labels must never be adopted.
foreach ($suffix in @($script:SiareLegacyVolumes + 'clickhouse-data')) {
    $name = "${script:SiareProject}_$suffix"
    if ($existing -contains $name) { Assert-SiareVolume $name }
}
foreach ($suffix in @($script:SiareLegacyVolumes + 'clickhouse-data')) {
    $name = "${script:SiareProject}_$suffix"
    if ($existing -contains $name) { Assert-SiareVolume $name; continue }
    if (!$NewInstallation -and $suffix -ne 'clickhouse-data') { throw "Falta $name. No se sustituiran datos por un volumen vacio." }
    & docker volume create --label "com.docker.compose.project=$script:SiareProject" --label "com.docker.compose.volume=$suffix" --label "io.siare.instance=$script:SiareInstance" $name | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "No se pudo crear $name." }
    Assert-SiareVolume $name
}
$network = "${script:SiareProject}_data"
$networks = @(& docker network ls --format '{{.Name}}')
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron listar redes.' }
if ($networks -notcontains $network) {
    & docker network create --internal --label "com.docker.compose.project=$script:SiareProject" --label 'com.docker.compose.network=data' --label "io.siare.instance=$script:SiareInstance" $network | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la red externa interna.' }
}
$net = @(& docker network inspect $network | ConvertFrom-Json)[0]
if ($LASTEXITCODE -ne 0 -or !$net.Internal -or $net.Driver -ne 'bridge' -or $net.Labels.'io.siare.instance' -ne $script:SiareInstance) {
    throw 'La red compartida debe ser bridge interna y pertenecer a esta instancia.'
}
Write-Host 'OK infraestructura: volumenes explicitos y red externa interna conservados.'
