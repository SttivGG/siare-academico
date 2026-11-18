[CmdletBinding()]
param([switch]$SkipBuild)
. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-SiareDocker
Assert-SiareOwnership
# Validate new definitions before any outage. No credentials are printed.
& (Join-Path $PSScriptRoot 'Initialize-H1.ps1')
Test-SiareComposeFiles
Assert-SiareExclusiveVolumes
$backup = & (Join-Path $PSScriptRoot 'Backup-Siare.ps1')
if (!(Test-Path -LiteralPath (Join-Path $backup 'manifest.json'))) { throw 'Falta respaldo completo. No se migra.' }
[ordered]@{ backup = $backup; phase2Commit = '2d7aa04d739f8f65245d25f2201ec033382b1bbe'; instance = $script:SiareInstance } |
    ConvertTo-Json | Set-Content (Join-Path $script:SiareRoot '.local/migration-h1.json') -Encoding UTF8
& (Join-Path $PSScriptRoot 'Start-Siare.ps1') -SkipBuild:$SkipBuild
Write-Host "Migracion terminada; respaldo: $backup"
