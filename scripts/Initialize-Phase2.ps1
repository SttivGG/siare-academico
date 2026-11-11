[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$envPath = Join-Path (Split-Path -Parent $PSScriptRoot) '.env'
if (!(Test-Path -LiteralPath $envPath)) { throw 'Ejecuta Initialize-Siare.ps1 primero.' }
$content = [IO.File]::ReadAllText($envPath)
if ($content -match '(?m)^CONTENT_SERVICE_TOKEN=([^\r\n]+)') {
    if ($Matches[1].Trim().Length -lt 32) { throw 'CONTENT_SERVICE_TOKEN requiere al menos 32 caracteres.' }
    Write-Host 'La credencial interna de Fase 2 ya existe; se conserva.'
    return
}
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
$secret = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
if ($content -match '(?m)^CONTENT_SERVICE_TOKEN=\r?$') {
    $content = [regex]::Replace($content, '(?m)^CONTENT_SERVICE_TOKEN=\r?$', ('CONTENT_SERVICE_TOKEN=' + $secret))
} else { $content += "`nCONTENT_SERVICE_TOKEN=$secret`n" }
[IO.File]::WriteAllText($envPath, $content, (New-Object Text.UTF8Encoding($false)))
Write-Host 'Credencial interna de Fase 2 creada. Las credenciales e identidad existentes se conservaron.'
