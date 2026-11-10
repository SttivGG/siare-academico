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
    & docker compose --project-name $script:SiareProject --project-directory $script:SiareRoot --env-file $script:SiareEnv --file (Join-Path $script:SiareRoot 'compose.yaml') @args
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose fallo (codigo $LASTEXITCODE)." }
}

function Assert-SiareDocker {
    & docker compose version
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
