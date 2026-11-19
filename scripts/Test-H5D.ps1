[CmdletBinding()]
param(
    [ValidateRange(1024,65535)][int]$MysqlPort = 13326,
    [string]$MavenRepository,
    [switch]$Offline,
    [switch]$SkipVerify
)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$runId = [Guid]::NewGuid().ToString('N')
$containerName = "siare-h5d-test-$runId"
$volumeName = "siare-h5d-test-data-$runId"
$mysqlImage = 'mysql:8.4.13@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902'
$variables = @('H5D_TEST_MYSQL_URL','H5D_TEST_MYSQL_USER','H5D_TEST_MYSQL_PASSWORD','H5D_TEST_EVIDENCE_DIR','H5D_MIGRATION_PHASE')
$previous = @{}
foreach ($name in $variables) { $previous[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
$mavenArguments = @('-B','-ntp','-f',(Join-Path $taskRoot 'services/core-api/siare-core/pom.xml'))
if ($Offline) { $mavenArguments += '-o' }
if ($MavenRepository) { $mavenArguments += "-Dmaven.repo.local=$MavenRepository" }
$evidence = Join-Path $taskRoot ".cache/h5d/$runId"
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
function Invoke-H5DMaven([string]$LogName, [string[]]$Goals) {
    & mvn @mavenArguments @Goals 2>&1 | Tee-Object -FilePath (Join-Path $evidence "$LogName.log")
    if ($LASTEXITCODE -ne 0) { throw "Falló $LogName; consulta $evidence." }
}
function Assert-H5DContainer {
    $label = & docker inspect --format '{{index .Config.Labels "com.siare.h5d-test-run"}}' $containerName
    if ($LASTEXITCODE -ne 0 -or $label -ne $runId) { throw 'Contenedor no pertenece a esta ejecución aislada.' }
}
function Wait-H5DMysql {
    $deadline = (Get-Date).AddMinutes(3)
    do {
        $health = & docker inspect --format '{{.State.Health.Status}}' $containerName
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo inspeccionar MySQL aislado.' }
        # The image can briefly start a bootstrap server before switching to its final server.
        if ($health -eq 'healthy') {
            & docker exec --env MYSQL_PWD=h5d-isolated-root $containerName mysql --user=root --protocol=TCP --host=127.0.0.1 --execute='SELECT 1' 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) { return }
        }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    throw 'MySQL aislado no alcanzó healthy.'
}
try {
    foreach ($name in $variables) { Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue }
    if (!$SkipVerify) { Invoke-H5DMaven 'verify' @('verify') }
    # No .env, existing network, production volume, Compose override or production credential is used.
    & docker volume create --label "com.siare.h5d-test-run=$runId" $volumeName | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el volumen de pruebas.' }
    & docker run --detach --name $containerName --label "com.siare.h5d-test-run=$runId" `
        --memory 768m --cpus 2 --mount "type=volume,source=$volumeName,target=/var/lib/mysql" `
        -p "127.0.0.1:${MysqlPort}:3306" `
        -e MYSQL_ROOT_PASSWORD=h5d-isolated-root -e MYSQL_DATABASE=siare_h5d_test `
        -e MYSQL_USER=siare_h5d_test -e MYSQL_PASSWORD=h5d-isolated-test `
        --health-cmd 'mysqladmin ping -h 127.0.0.1 --silent' --health-interval 2s --health-timeout 2s --health-retries 90 $mysqlImage | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear MySQL aislado.' }
    Assert-H5DContainer
    Wait-H5DMysql
    & docker exec --env MYSQL_PWD=h5d-isolated-root $containerName mysql --user=root --execute="CREATE DATABASE siare_h5d_migration_test; GRANT ALL ON siare_h5d_migration_test.* TO 'siare_h5d_test'@'%';"
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el esquema aislado de migraciones.' }
    $env:H5D_TEST_MYSQL_URL = "jdbc:mysql://127.0.0.1:${MysqlPort}/siare_h5d_test?allowPublicKeyRetrieval=true&sslMode=DISABLED&connectionTimeZone=UTC"
    $env:H5D_TEST_MYSQL_USER = 'siare_h5d_test'
    $env:H5D_TEST_MYSQL_PASSWORD = 'h5d-isolated-test'
    $env:H5D_TEST_EVIDENCE_DIR = $evidence
    $env:H5D_MIGRATION_PHASE = 'baseline'
    Invoke-H5DMaven 'migration-v5' @('-Dtest=AcademicDraftMigrationTests','test')
    Assert-H5DContainer
    & docker exec --env MYSQL_PWD=h5d-isolated-root $containerName mysqldump --user=root --single-transaction --add-drop-database --databases siare_h5d_migration_test --result-file=/tmp/pre-v6.sql
    if ($LASTEXITCODE -ne 0) { throw 'Falló respaldo V5 aislado.' }
    & docker cp "${containerName}:/tmp/pre-v6.sql" (Join-Path $evidence 'pre-v6.sql')
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo conservar el respaldo local.' }
    $env:H5D_MIGRATION_PHASE = 'upgrade'
    Invoke-H5DMaven 'migration-v6' @('-Dtest=AcademicDraftMigrationTests','test')
    Assert-H5DContainer
    # Explicit restore of only the disposable migration schema, never the running application's database.
    & docker exec --env MYSQL_PWD=h5d-isolated-root $containerName mysql --user=root --execute='source /tmp/pre-v6.sql'
    if ($LASTEXITCODE -ne 0) { throw 'Falló restauración V5 aislada.' }
    $env:H5D_MIGRATION_PHASE = 'restore'
    Invoke-H5DMaven 'migration-restored' @('-Dtest=AcademicDraftMigrationTests','test')
    Remove-Item -LiteralPath Env:H5D_MIGRATION_PHASE
    Invoke-H5DMaven 'mysql-lifecycle' @('-Dtest=AcademicDraftLifecycleTests','test')
    Assert-H5DContainer
    & docker restart $containerName | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Falló reinicio del MySQL aislado.' }
    Wait-H5DMysql
    Invoke-H5DMaven 'mysql-restart' @('-Dtest=AcademicDraftRestartTests','-DexcludedGroups=none','test')
    & docker inspect --format '{{json .Mounts}}' $containerName | Set-Content -Encoding UTF8 (Join-Path $evidence 'mounts.json')
    $sourceStatus = @(& git -C $taskRoot status --porcelain)
    $sourceRoot = Join-Path $taskRoot 'services/core-api/siare-core'
    $sourceFiles = @(Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'src') -File -Recurse) + @(Get-Item -LiteralPath (Join-Path $sourceRoot 'pom.xml'))
    @($sourceFiles | Sort-Object FullName | ForEach-Object {
        @{ path=$_.FullName.Substring($taskRoot.Length + 1).Replace('\','/'); sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
    }) | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $evidence 'source-sha256.json')
    @{
        runId=$runId; container=$containerName; volume=$volumeName; image=$mysqlImage
        database='siare_h5d_test'; port=$MysqlPort; backup='pre-v6.sql'
        branch=(& git -C $taskRoot branch --show-current); commit=(& git -C $taskRoot rev-parse HEAD)
        workingTreeDirty=($sourceStatus.Count -gt 0); sourceHashes='source-sha256.json'
    } | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $evidence 'run.json')
    Write-Host "OK H5-D: respaldo/restauración V5, V6, concurrencia y reinicio. Evidencias: $evidence"
} finally {
    foreach ($name in $variables) {
        if ($null -eq $previous[$name]) { Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue }
        else { [Environment]::SetEnvironmentVariable($name,$previous[$name],'Process') }
    }
    $found = & docker ps --all --filter "name=^${containerName}$" --filter "label=com.siare.h5d-test-run=$runId" --format '{{.ID}}'
    if ($found) { & docker stop $containerName | Out-Null }
    # Deliberately preserve the stopped container, named volume and native dump for inspection/restart.
    Write-Host "Pruebas aisladas conservadas: $containerName / $volumeName"
}
