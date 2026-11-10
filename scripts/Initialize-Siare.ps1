[CmdletBinding()]
param([ValidatePattern('^[a-z0-9][a-z0-9_-]+$')][string]$ProjectName = 'siare-academico')

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot '.env'
if (Test-Path -LiteralPath $envPath) {
    Write-Host '.env ya existe. No se modificaron las credenciales ni la identidad.'
    return
}

function New-LocalSecret {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
}

$content = [IO.File]::ReadAllText((Join-Path $repoRoot '.env.example'))
$content = $content.Replace('COMPOSE_PROJECT_NAME=siare-academico', "COMPOSE_PROJECT_NAME=$ProjectName")
$content = $content.Replace('SIARE_INSTANCE_ID=', ('SIARE_INSTANCE_ID=' + [Guid]::NewGuid().ToString('N')))
foreach ($key in @('MYSQL_PASSWORD', 'MYSQL_ROOT_PASSWORD', 'MONGO_PASSWORD', 'MONGO_ROOT_PASSWORD', 'REDIS_PASSWORD')) {
    $content = [regex]::Replace($content, "(?m)^${key}=\r?$", ($key + '=' + (New-LocalSecret)))
}
# CreateNew also prevents a concurrent initialization from replacing an existing .env.
$stream = [IO.File]::Open($envPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $bytes = (New-Object Text.UTF8Encoding($false)).GetBytes($content)
    $stream.Write($bytes, 0, $bytes.Length)
} finally { $stream.Dispose() }
Write-Host '.env creado con credenciales aleatorias para desarrollo local. No lo compartas ni lo versiones.'
