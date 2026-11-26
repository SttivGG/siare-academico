[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Las credenciales de extracción y aprendizaje son independientes para permitir
# políticas de acceso y rotación separadas sin mezclar secretos.
$envPath = Join-Path (Split-Path -Parent $PSScriptRoot) '.env'
if (!(Test-Path -LiteralPath $envPath)) { throw 'Ejecuta Initialize-Siare.ps1 primero.' }
$content = [IO.File]::ReadAllText($envPath)

function New-SiareSecret {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
}

foreach ($setting in @(
    @{ Name = 'CONTENT_SERVICE_TOKEN'; Purpose = 'La credencial interna de extracción de documentos' },
    @{ Name = 'LEARNING_SERVICE_TOKEN'; Purpose = 'La credencial interna de aprendizaje adaptativo' }
)) {
    $name = $setting.Name
    $existing = [regex]::Match($content, "(?m)^${name}=([^`r`n]+)")

    if ($existing.Success) {
        if ($existing.Groups[1].Value.Trim().Length -lt 32) {
            throw "$name requiere al menos 32 caracteres."
        }
        Write-Host "$($setting.Purpose) ya existe; se conserva."
        continue
    }

    $secret = New-SiareSecret
    if ([regex]::IsMatch($content, "(?m)^${name}=`r?$")) {
        $content = [regex]::Replace($content, "(?m)^${name}=`r?$", ($name + '=' + $secret))
    } else {
        $content += "`n${name}=${secret}`n"
    }
}

if (!([regex]::IsMatch($content, '(?m)^LEARNING_MAX_BYTES=([^\r\n]+)'))) {
    $content += "`nLEARNING_MAX_BYTES=65536`n"
}

[IO.File]::WriteAllText($envPath, $content, (New-Object Text.UTF8Encoding($false)))
Write-Host 'Credenciales internas de Fase 2 creadas. Las credenciales existentes se conservaron.'
