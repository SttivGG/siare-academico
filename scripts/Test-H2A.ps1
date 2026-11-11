[CmdletBinding()]
param([switch]$RestartContainers)
. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-SiareDocker
Assert-SiareOwnership
$testArgs=@((Join-Path $PSScriptRoot 'test-h2a.mjs'))
if ($RestartContainers) { $testArgs+='--restart' }
& node @testArgs
if ($LASTEXITCODE -ne 0) { throw 'Falló la validación H2-A.' }
& (Join-Path $PSScriptRoot 'Test-Siare.ps1')
