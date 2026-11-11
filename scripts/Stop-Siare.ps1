[CmdletBinding()]
param([switch]$RemoveContainers)

. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-SiareDocker
Assert-SiareOwnership
Invoke-SiareCompose stop --timeout 90 @script:SiareAppServices
Invoke-SiareCompose stop --timeout 90 @script:SiareDataServices
if ($RemoveContainers) { Invoke-SiareCompose rm --force @script:SiareAppServices @script:SiareDataServices }
Write-Host 'SIARE detenido. Se conservaron los volumenes persistentes.'
