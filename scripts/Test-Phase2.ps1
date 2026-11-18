[CmdletBinding()]
param([switch]$RestartContainers, [switch]$SimulatePythonOutage)
. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-SiareDocker
Assert-SiareOwnership
Test-SiareComposeFiles
Invoke-SiareCompose exec -T content-ai python tests/fixture_factory.py /tmp/siare-phase2-fixtures
$fixtures = Join-Path $script:SiareRoot '.cache/phase2-fixtures'
New-Item -ItemType Directory -Path $fixtures -Force | Out-Null
Invoke-SiareCompose cp 'content-ai:/tmp/siare-phase2-fixtures/.' $fixtures
$testArgs = @((Join-Path $PSScriptRoot 'test-phase2.mjs'))
if ($RestartContainers) { $testArgs += '--restart' }
if ($SimulatePythonOutage) { $testArgs += '--outage' }
& node @testArgs
if ($LASTEXITCODE -ne 0) { throw 'Fallo la verificacion real de la fase 2.' }
& (Join-Path $PSScriptRoot 'Test-Siare.ps1')
