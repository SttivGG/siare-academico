[CmdletBinding()]
param([ValidateRange(120, 3600)][int]$WaitTimeout = 900, [switch]$SkipBuild)

& (Join-Path $PSScriptRoot 'Initialize-Phase2.ps1')
. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-SiareDocker
Assert-SiareOwnership
Assert-SiareReadyForSplit
Assert-SiareExclusiveVolumes
& (Join-Path $PSScriptRoot 'Initialize-H1.ps1')
& (Join-Path $PSScriptRoot 'Initialize-SiareInfrastructure.ps1')
& (Join-Path $PSScriptRoot 'Initialize-SiareKeys.ps1')
Test-SiareComposeFiles

# Existing SIARE containers may already own these ports; unrelated listeners must not be stopped.
$existing = @(Invoke-SiareCompose ps --status running --quiet)
if ($existing.Count -eq 0) {
    foreach ($port in @(3100, 8180)) {
        $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
        try { $listener.Start() } catch { throw "Puerto $port ocupado. Libera ese puerto manualmente; SIARE no detendra otros proyectos." }
        finally { $listener.Stop() }
    }
}

$previousLimit = $env:COMPOSE_PARALLEL_LIMIT
$env:COMPOSE_PARALLEL_LIMIT = '1'
try {
    if (!$SkipBuild) {
        # Build one service at a time, including when Compose delegates to Bake.
        foreach ($service in @('core-api', 'content-ai', 'progress-api', 'frontend')) {
            Invoke-SiareCompose build $service
        }
    }
    Invoke-SiareCompose up --detach --wait --wait-timeout $WaitTimeout @script:SiareDataServices
    Invoke-SiareCompose up --detach --wait --wait-timeout $WaitTimeout @script:SiareAppServices
} finally { $env:COMPOSE_PARALLEL_LIMIT = $previousLimit }
& (Join-Path $PSScriptRoot 'Test-Siare.ps1')
