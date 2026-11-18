[CmdletBinding()]
param(
    [ValidateRange(1024,65535)][int]$MysqlPort = 13316,
    [string]$MavenRepository,
    [switch]$Offline,
    [switch]$SkipVerify
)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$runId = [Guid]::NewGuid().ToString('N')
$containerName = "siare-h3-test-$runId"
$mysqlImage = 'mysql:8.4.13@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902'
$variables = @('H3_TEST_MYSQL_URL','H3_TEST_MYSQL_USER','H3_TEST_MYSQL_PASSWORD','H3_TEST_EVIDENCE_DIR')
$previous = @{}
foreach ($name in $variables) { $previous[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
$mavenArguments = @('-B','-ntp','-f',(Join-Path $taskRoot 'services/core-api/siare-core/pom.xml'))
if ($Offline) { $mavenArguments += '-o' }
if ($MavenRepository) { $mavenArguments += "-Dmaven.repo.local=$MavenRepository" }
$cache = Join-Path $taskRoot '.cache'
New-Item -ItemType Directory -Force -Path $cache | Out-Null
try {
    foreach ($name in $variables) { Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue }
    if (!$SkipVerify) {
        & mvn @mavenArguments verify 2>&1 | Tee-Object -FilePath (Join-Path $cache 'h3-verify.log')
        if ($LASTEXITCODE -ne 0) { throw 'Falló Maven verify; consulta .cache/h3-verify.log.' }
    }
    # Dedicated disposable MySQL. No .env, application network or existing volume is used.
    & docker run --detach --name $containerName --label "com.siare.h3-test-run=$runId" `
        --memory 768m --cpus 2 --tmpfs '/var/lib/mysql:rw,size=512m' `
        -p "127.0.0.1:${MysqlPort}:3306" `
        -e MYSQL_ROOT_PASSWORD=h3-isolated-root -e MYSQL_DATABASE=siare_h3_test `
        -e MYSQL_USER=siare_h3_test -e MYSQL_PASSWORD=h3-isolated-test `
        --health-cmd 'mysqladmin ping -h 127.0.0.1 --silent' --health-interval 2s --health-timeout 2s --health-retries 60 $mysqlImage
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el MySQL temporal; comprueba Docker y el puerto indicado.' }
    $deadline = (Get-Date).AddMinutes(2)
    do {
        $health = & docker inspect --format '{{.State.Health.Status}}' $containerName
        if ($health -eq 'healthy') { break }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    if ($health -ne 'healthy') { throw 'El MySQL temporal no alcanzó estado healthy.' }
    $env:H3_TEST_MYSQL_URL = "jdbc:mysql://127.0.0.1:${MysqlPort}/siare_h3_test?allowPublicKeyRetrieval=true&sslMode=DISABLED&connectionTimeZone=UTC"
    $env:H3_TEST_MYSQL_USER = 'siare_h3_test'
    $env:H3_TEST_MYSQL_PASSWORD = 'h3-isolated-test'
    $env:H3_TEST_EVIDENCE_DIR = Join-Path $cache 'h3-examples'
    & mvn @mavenArguments '-Dtest=ActivityApiTests,ActivityFactoryTests' test 2>&1 | Tee-Object -FilePath (Join-Path $cache 'h3-mysql.log')
    if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas H3 con MySQL; consulta .cache/h3-mysql.log.' }
    & mvn @mavenArguments '-Dtest=ActivityRestartTests' '-DexcludedGroups=none' test 2>&1 | Tee-Object -FilePath (Join-Path $cache 'h3-restart.log')
    if ($LASTEXITCODE -ne 0) { throw 'Falló la lectura H3 tras reiniciar la JVM; consulta .cache/h3-restart.log.' }
} finally {
    foreach ($name in $variables) {
        if ($null -eq $previous[$name]) { Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue }
        else { [Environment]::SetEnvironmentVariable($name,$previous[$name],'Process') }
    }
    $labelsJson = & docker inspect --format '{{json .Config.Labels}}' $containerName 2>$null
    if ($LASTEXITCODE -eq 0) {
        $labels = $labelsJson | ConvertFrom-Json
        if ($labels.'com.siare.h3-test-run' -eq $runId) { & docker rm --force $containerName | Out-Null }
    }
}
