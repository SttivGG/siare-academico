[CmdletBinding()]
param([switch]$RestartContainers)
. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-SiareDocker
Assert-SiareOwnership
Test-SiareComposeFiles
$cache = Join-Path $script:SiareRoot '.cache'
New-Item -ItemType Directory -Force -Path $cache | Out-Null
$rootMount = "${script:SiareRoot}:/workspace"
$testImage = "${script:SiareProject}-oidc-tests:0.1.0"
# The data network is deliberately internal. Resolve dependencies while building,
# then run offline inside it; do not grant external network to the databases.
& docker build --target build -t $testImage (Join-Path $script:SiareRoot 'services/core-api/siare-core')
if ($LASTEXITCODE -ne 0) { throw 'Falló la construcción de la imagen de pruebas OIDC.' }
# Explicit real-store suite: controlled loopback OIDC, real MySQL and Redis.
# Reads the existing external environment file without printing its values.
& docker run --rm --network "${script:SiareProject}_data" --memory 1g --cpus 2 `
    --env-file $script:SiareEnv -e H2B2_SESSION_EVIDENCE=/workspace/.cache/h2b2-oidc-session.json `
    -v $rootMount -w /workspace/services/core-api/siare-core $testImage `
    mvn -o -B -ntp '-Dtest=OidcRealStoresTests' '-DexcludedGroups=none' test
if ($LASTEXITCODE -ne 0) { throw 'Falló OIDC con MySQL/Redis reales.' }
if ($RestartContainers) {
    Invoke-SiareCompose restart mysql core-api frontend
    $deadline=(Get-Date).AddMinutes(4)
    do {
        $ready=$true
        foreach ($service in @('mysql','core-api','frontend')) {
            $id=@(Invoke-SiareCompose ps -q $service)[0]
            $state=& docker inspect --format '{{.State.Health.Status}}' $id
            if ($LASTEXITCODE -ne 0 -or $state -ne 'healthy') { $ready=$false }
        }
        if (!$ready) { Start-Sleep -Seconds 3 }
    } while (!$ready -and (Get-Date) -lt $deadline)
    if (!$ready) { throw 'Los servicios no recuperaron salud después del reinicio.' }
}
& node (Join-Path $PSScriptRoot 'test-h2b2.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Falló la validación HTTP H2-B2.' }
& (Join-Path $PSScriptRoot 'Test-Siare.ps1')
