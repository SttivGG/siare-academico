[CmdletBinding()]
param()

. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-SiareDocker
Assert-SiareOwnership
Test-SiareComposeFiles
Assert-SiareExclusiveVolumes

$expected = @($script:SiareDataServices + $script:SiareAppServices)
foreach ($service in $expected) {
    $id = Invoke-SiareCompose ps --quiet $service
    if (!$id) { throw "Servicio ausente: $service" }
    $health = & docker inspect --format '{{.State.Health.Status}}' $id
    if ($LASTEXITCODE -ne 0 -or $health -ne 'healthy') { throw "$service no esta healthy: $health" }
    Write-Host "OK healthy: $service"
}

# Re-run each real DB healthcheck, without printing credentials.
foreach ($service in $script:SiareDataServices) {
    $id = Invoke-SiareCompose ps --quiet $service
    $probeJson = & docker inspect --format '{{json .Config.Healthcheck.Test}}' $id
    if ($LASTEXITCODE -ne 0) { throw "No se pudo obtener el healthcheck: $service" }
    # PS 5.1 preserves a JSON array as one pipeline item; avoid wrapping it again.
    $probe = ConvertFrom-Json -InputObject $probeJson
    if ($probe[0] -eq 'CMD-SHELL') {
        Invoke-SiareCompose exec -T $service sh -ec $probe[1]
    } elseif ($probe[0] -eq 'CMD') {
        $probeCommand = @('exec', '-T', $service) + @($probe[1..($probe.Count - 1)])
        Invoke-SiareCompose @probeCommand
    } else { throw "Healthcheck no soportado: $service" }
    Write-Host "OK conexion autenticada/consulta: $service"
}

$core = Invoke-RestMethod -Uri 'http://127.0.0.1:8180/health' -TimeoutSec 20
if ($core.status -ne 'UP') { throw 'Spring no responde UP.' }
Invoke-SiareCompose exec -T content-ai python -c "import json,urllib.request; r=json.load(urllib.request.urlopen('http://127.0.0.1:5000/health',timeout=8)); assert r['status']=='UP'; print('OK Flask y Mongo/Redis')"
Invoke-SiareCompose exec -T progress-api node -e "fetch('http://127.0.0.1:3001/health',{signal:AbortSignal.timeout(8000)}).then(async r=>{if(!r.ok||(await r.json()).status!=='UP')process.exit(1);console.log('OK Express y Cassandra')}).catch(()=>process.exit(1))"
$frontend = Invoke-RestMethod -Uri 'http://127.0.0.1:3100/api/health' -TimeoutSec 10
if ($frontend.status -ne 'UP') { throw 'Fallo frontend -> servidor Next.js -> Spring.' }
$page = Invoke-WebRequest -Uri 'http://127.0.0.1:3100/' -UseBasicParsing -TimeoutSec 15
if ($page.StatusCode -ne 200 -or $page.Content -notmatch 'Spring disponible') { throw 'La pagina no confirma comunicacion con Spring.' }

# Prove only the two approved host ports are published.
foreach ($service in $expected) {
    $id = Invoke-SiareCompose ps --quiet $service
    $bindings = & docker inspect --format '{{json .HostConfig.PortBindings}}' $id | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw "No se pudieron inspeccionar puertos: $service" }
    if ($null -eq $bindings) { continue }
    foreach ($property in $bindings.PSObject.Properties) {
        foreach ($binding in $property.Value) {
            $allowed = ($service -eq 'frontend' -and $binding.HostPort -eq '3100') -or ($service -eq 'core-api' -and $binding.HostPort -eq '8180')
            if (!$allowed -or $binding.HostIp -ne '127.0.0.1') { throw "Puerto no autorizado publicado por $service." }
        }
    }
}
& (Join-Path $PSScriptRoot 'Test-ClickHouse.ps1')
Write-Host 'OK: tres backends, cinco motores de datos, puertos y frontend -> Spring.'
