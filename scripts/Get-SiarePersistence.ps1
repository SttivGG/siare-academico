[CmdletBinding()]
param([Parameter(Mandatory)][string]$OutputPath)
. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-SiareDocker
Assert-SiareOwnership
$sql = 'SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM subjects; CHECKSUM TABLE users, subjects;'
$probe = 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql --protocol=TCP -h127.0.0.1 -u"$MYSQL_USER" -D"$MYSQL_DATABASE" --batch --skip-column-names'
$mysql = @($sql | & docker compose @script:SiareComposeArgs exec -T mysql sh -ec $probe)
if ($LASTEXITCODE -ne 0) { throw 'No se pudo verificar MySQL.' }
$mongoProbe = @'
import os, json, hashlib
from pymongo import MongoClient
from bson.json_util import dumps, CANONICAL_JSON_OPTIONS
db = MongoClient('mongo', username=os.environ['MONGO_USER'], password=os.environ['MONGO_PASSWORD'], authSource=os.environ['MONGO_DATABASE'], serverSelectionTimeoutMS=5000)[os.environ['MONGO_DATABASE']]
result = {}
for name in ['document_metadata','document_fragments','fs.files','fs.chunks']:
    digest = hashlib.sha256(); count = 0
    for row in db[name].find().sort('_id', 1):
        digest.update(dumps(row,sort_keys=True,json_options=CANONICAL_JSON_OPTIONS).encode()); count += 1
    result[name] = {'count':count,'sha256':digest.hexdigest()}
print(json.dumps(result,sort_keys=True))
'@
$mongo = Invoke-SiareCompose exec -T content-ai python -c $mongoProbe
$keys = Invoke-SiareCompose exec -T core-api sha256sum /run/siare-keys/private.pem /run/siare-keys/public.pem
$mounts = @()
foreach ($id in @(Get-SiareContainers)) {
    $c = @(& docker inspect $id | ConvertFrom-Json)[0]
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron inspeccionar montajes.' }
    foreach ($m in $c.Mounts) { if ($m.Type -eq 'volume' -and $m.Name -notmatch '_clickhouse-data$') { $mounts += "$($c.Config.Labels.'com.docker.compose.service')|$($m.Name)|$($m.Destination)" } }
}
$result = [ordered]@{ mysql = $mysql; mongo = ($mongo | ConvertFrom-Json); keys = @($keys); mounts = @($mounts | Sort-Object) }
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Host "OK: resumen MySQL, hash de todas las colecciones GridFS/texto, claves y montajes guardado en $OutputPath"
