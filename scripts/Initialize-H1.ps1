[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'Common.ps1')
$content = [IO.File]::ReadAllText($script:SiareEnv)
$defaults = @{ CLICKHOUSE_DB = 'siare_analytics'; CLICKHOUSE_USER = 'siare_analytics' }
foreach ($key in @('CLICKHOUSE_DB', 'CLICKHOUSE_USER', 'CLICKHOUSE_PASSWORD')) {
    $match = [regex]::Match($content, "(?m)^${key}=([^\r\n]*)")
    if ($match.Success -and $match.Groups[1].Value.Trim()) { continue }
    if ($key -eq 'CLICKHOUSE_PASSWORD') {
        $bytes = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        $value = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
    } else { $value = $defaults[$key] }
    if ($match.Success) { $content = [regex]::Replace($content, "(?m)^${key}=[^\r\n]*", "$key=$value") }
    else { $content += "`n$key=$value`n" }
}
foreach ($key in @('CLICKHOUSE_DB', 'CLICKHOUSE_USER')) {
    $value = [regex]::Match($content, "(?m)^${key}=([^\r\n]+)").Groups[1].Value.Trim()
    if ($value -notmatch '^[a-z][a-z0-9_]{1,62}$') { throw "$key requiere un identificador SQL simple." }
}
if ($content -ne [IO.File]::ReadAllText($script:SiareEnv)) { [IO.File]::WriteAllText($script:SiareEnv, $content, (New-Object Text.UTF8Encoding($false))) }
Write-Host 'OK H1: credencial ClickHouse preparada; valores anteriores conservados.'
