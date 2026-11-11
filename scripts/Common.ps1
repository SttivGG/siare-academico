Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:SiareRoot = Split-Path -Parent $PSScriptRoot
$script:SiareEnv = Join-Path $script:SiareRoot '.env'
if (!(Test-Path -LiteralPath $script:SiareEnv)) {
    throw 'Falta .env. Ejecuta .\scripts\Initialize-Siare.ps1 primero.'
}

function Get-SiareSetting([string]$Name) {
    $match = [regex]::Match([IO.File]::ReadAllText($script:SiareEnv), "(?m)^${Name}=([^\r\n]+)")
    if (!$match.Success) { throw "Falta la variable $Name en .env." }
    return $match.Groups[1].Value.Trim()
}

$script:SiareProject = Get-SiareSetting 'COMPOSE_PROJECT_NAME'
$script:SiareInstance = Get-SiareSetting 'SIARE_INSTANCE_ID'
if ($script:SiareProject -notmatch '^[a-z0-9][a-z0-9_-]+$' -or $script:SiareInstance -notmatch '^[a-f0-9]{32}$') {
    throw 'Nombre de proyecto o identidad SIARE invalidos.'
}

function Invoke-SiareCompose {
    & docker compose @script:SiareComposeArgs @args
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose fallo (codigo $LASTEXITCODE)." }
}

$script:SiareComposeArgs = @('--project-name', $script:SiareProject, '--project-directory', $script:SiareRoot,
    '--env-file', $script:SiareEnv, '--file', (Join-Path $script:SiareRoot 'compose.datos.yml'),
    '--file', (Join-Path $script:SiareRoot 'compose.apps.yml'))
$script:SiareDataServices = @('mysql', 'mongo', 'cassandra', 'redis', 'clickhouse')
$script:SiareAppServices = @('core-api', 'content-ai', 'progress-api', 'frontend')
$script:SiareLegacyVolumes = @('mysql-data', 'mongo-data', 'mongo-config', 'cassandra-data', 'redis-data', 'jwt-keys')
$script:SiareHelperImage = 'redis:7.4.12-alpine@sha256:7b1753b4c5ad8458906c272a8132b8c15f5557b000379eb115fb239706a384b7'

function Get-SiareContainers {
    $ids = @(& docker ps -aq --filter "label=com.docker.compose.project=$script:SiareProject")
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo listar SIARE.' }
    return @($ids | Where-Object { ![string]::IsNullOrWhiteSpace($_) })
}

function Assert-SiareVolume([string]$Name) {
    $v = @(& docker volume inspect $Name | ConvertFrom-Json)
    if ($LASTEXITCODE -ne 0) { throw "Falta volumen persistente $Name. Recupera el respaldo; no se creara un reemplazo vacio." }
    if ($v[0].Labels.'io.siare.instance' -ne $script:SiareInstance -or $v[0].Labels.'com.docker.compose.project' -ne $script:SiareProject) {
        throw "Volumen $Name ajeno a esta instancia."
    }
}

function Assert-SiareVolumesIdle([string[]]$Names) {
    foreach ($name in $Names) {
        $active = @(& docker ps -q --filter "volume=$name")
        if ($LASTEXITCODE -ne 0) { throw "No se pudieron comprobar consumidores de $name." }
        if ($active.Count -gt 0) { throw "Volumen $name en uso. Deten sus contenedores antes del respaldo o recuperacion." }
    }
}

function Assert-SiareReadyForSplit {
    foreach ($id in @(Get-SiareContainers)) {
        $details = @(& docker inspect $id | ConvertFrom-Json)
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo leer la configuracion de origen.' }
        $files = $details[0].Config.Labels.'com.docker.compose.project.config_files'
        if ($files -match 'compose\.yaml' -and !(Test-Path (Join-Path $script:SiareRoot '.local/migration-h1.json'))) {
            throw 'Instancia Fase 2 detectada. Ejecuta Migrate-Siare.ps1 para respaldar antes de recrear.'
        }
    }
}

function Assert-SiareExclusiveVolumes {
    $owners = @{ 'mysql-data' = 'mysql'; 'mongo-data' = 'mongo'; 'mongo-config' = 'mongo';
        'cassandra-data' = 'cassandra'; 'redis-data' = 'redis'; 'clickhouse-data' = 'clickhouse'; 'jwt-keys' = 'core-api' }
    foreach ($suffix in $owners.Keys) {
        $name = "${script:SiareProject}_$suffix"
        $ids = @(& docker ps -q --filter "volume=$name")
        if ($LASTEXITCODE -ne 0) { throw "No se pudieron comprobar consumidores de $name." }
        if ($ids.Count -gt 1) { throw "Mas de un contenedor usa $name. No se inicia otro servidor." }
        foreach ($id in $ids) {
            $c = @(& docker inspect $id | ConvertFrom-Json)[0]
            if ($LASTEXITCODE -ne 0 -or $c.Config.Labels.'com.docker.compose.project' -ne $script:SiareProject -or
                $c.Config.Labels.'io.siare.instance' -ne $script:SiareInstance -or $c.Config.Labels.'com.docker.compose.service' -ne $owners[$suffix]) {
                throw "Un consumidor inesperado usa $name. No se modifica."
            }
        }
    }
}

function Test-SiareComposeFiles {
    foreach ($file in @('compose.datos.yml', 'compose.apps.yml')) {
        & docker compose --project-name $script:SiareProject --project-directory $script:SiareRoot --env-file $script:SiareEnv --file (Join-Path $script:SiareRoot $file) config --quiet
        if ($LASTEXITCODE -ne 0) { throw "Compose invalido: $file" }
    }
    Invoke-SiareCompose config --quiet
}

function Assert-SiareDocker {
    & docker compose version | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'Instala/activa Docker Compose v2 en Docker Desktop.' }
    $os = & docker info --format '{{.OSType}}'
    if ($LASTEXITCODE -ne 0 -or $os -ne 'linux') { throw 'Docker Desktop debe estar iniciado y usar contenedores Linux.' }
}

function Assert-SiareOwnership {
    # Inspect only resources with this Compose project label; refuse foreign instances.
    foreach ($kind in @('container', 'volume', 'network')) {
        if ($kind -eq 'container') {
            $ids = @(& docker ps -aq --filter "label=com.docker.compose.project=$script:SiareProject")
        } else {
            $ids = @(& docker $kind ls -q --filter "label=com.docker.compose.project=$script:SiareProject")
        }
        if ($LASTEXITCODE -ne 0) { throw "No se pudieron inspeccionar recursos $kind." }
        foreach ($id in $ids) {
            if ([string]::IsNullOrWhiteSpace($id)) { continue }
            $details = @(& docker $kind inspect $id | ConvertFrom-Json)
            if ($LASTEXITCODE -ne 0) { throw "No se pudo inspeccionar $kind $id." }
            $labels = if ($kind -eq 'container') { $details[0].Config.Labels } else { $details[0].Labels }
            $owner = if ($null -ne $labels -and $labels.PSObject.Properties.Name -contains 'io.siare.instance') { $labels.'io.siare.instance' } else { '' }
            if ($owner -ne $script:SiareInstance) {
                throw "El recurso $kind $id pertenece a otra instancia. No se modifico. Usa otro ProjectName al inicializar una copia nueva."
            }
        }
    }
}
