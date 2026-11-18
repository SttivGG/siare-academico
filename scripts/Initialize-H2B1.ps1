[CmdletBinding()]
param([string]$KeyFile = $(if ($env:H2B1_MFA_KEY_FILE) { $env:H2B1_MFA_KEY_FILE } else { Join-Path $env:LOCALAPPDATA 'SIARE/identity/totp.key' }), [switch]$FirstProvision)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$absolute = [IO.Path]::GetFullPath($KeyFile)
$repository = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
if ($absolute.StartsWith($repository + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'La clave TOTP debe residir fuera del repositorio. Configura H2B1_MFA_KEY_FILE.'
}
if (Test-Path -LiteralPath $absolute) {
    $bytes = [Convert]::FromBase64String([IO.File]::ReadAllText($absolute).Trim())
    if ($bytes.Length -ne 32) { throw 'La clave existente es inválida. Restaura su respaldo; no se regeneró.' }
    Write-Host 'OK: clave MFA existente conservada; no se muestra su contenido.'
    return
}
# Explicit first-time provisioning only. Never invoke this automatically on application restart.
if (!$FirstProvision) { throw 'Falta la clave externa. Restaura su respaldo. Solo un alta inicial confirmada admite -FirstProvision.' }
$directory = Split-Path -Parent $absolute
New-Item -ItemType Directory -Path $directory -Force | Out-Null
if ([Environment]::OSVersion.Platform -eq 'Win32NT') {
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
    Set-Acl -LiteralPath $directory -AclObject $acl
}
$secret = [byte[]]::new(32)
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($secret) } finally { $rng.Dispose() }
$stream = [IO.File]::Open($absolute,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try {
    $encoded = [Text.Encoding]::ASCII.GetBytes([Convert]::ToBase64String($secret))
    $stream.Write($encoded,0,$encoded.Length)
} finally { $stream.Dispose(); [Array]::Clear($secret,0,$secret.Length) }
Write-Host 'OK: clave MFA creada fuera de Git. Respalda este archivo mediante el procedimiento H2B1 antes de dar de alta factores.'
