[CmdletBinding()]
param([switch]$RemoveContainers)

. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-SiareDocker
Assert-SiareOwnership
if ($RemoveContainers) {
    # Removes only this project's containers and networks. Persistent volumes are retained.
    Invoke-SiareCompose down --timeout 90
} else {
    Invoke-SiareCompose stop --timeout 90
}
Write-Host 'SIARE detenido. Se conservaron los volumenes persistentes.'
