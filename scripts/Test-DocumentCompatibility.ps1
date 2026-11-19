[CmdletBinding()]
param(
    [string]$OriginalPdf,
    [switch]$BuildProcessor
)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
if (!$OriginalPdf) { $OriginalPdf = Join-Path $taskRoot '.cache/pdf-diagnosis/original.pdf' }
$OriginalPdf = (Resolve-Path -LiteralPath $OriginalPdf).Path
$evidence = Join-Path $taskRoot '.cache/document-compatibility'
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
$processorImage = 'siare-academico-content-ai:document-compat'
if ($BuildProcessor) {
    & docker build -t $processorImage (Join-Path $taskRoot 'services/content-ai')
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo construir el procesador.' }
}
# No service network, .env, keys, Docker socket, databases or persistent volume is mounted.
& docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges `
    --memory 256m --cpus 1 --pids-limit 64 --ulimit nofile=64:64 --ulimit fsize=8388608:8388608 `
    --tmpfs '/tmp:rw,noexec,nosuid,size=64m' -e SIARE_REAL_OCR=1 -e SIARE_TEST_PDF=/input.pdf `
    -v "${taskRoot}/services/content-ai/app:/app/app:ro" -v "${taskRoot}/services/content-ai/tests:/app/tests:ro" `
    -v "${OriginalPdf}:/input.pdf:ro" --entrypoint python $processorImage -m unittest discover -s tests -v `
    2>&1 | Tee-Object -FilePath (Join-Path $evidence 'python.log')
if ($LASTEXITCODE -ne 0) { throw 'Falló la suite Python; consulta python.log.' }

# Offline toolchain/cache; only the disposable scratch copy is writable.
& docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges `
    --memory 1024m --cpus 2 --pids-limit 256 --tmpfs '/tmp:rw,nosuid,size=128m' --tmpfs '/scratch:rw,exec,nosuid,size=512m' `
    -v "${taskRoot}/services/core-api/siare-core:/source:ro" -v "${taskRoot}/.cache/m2:/m2:ro" `
    -v "${OriginalPdf}:/input.pdf:ro" -e MAVEN_OPTS=-Xmx256m --entrypoint sh maven:3.10.0-eclipse-temurin-21-alpine `
    -c 'mkdir /scratch/core; cp /source/pom.xml /scratch/core/; cp -a /source/src /scratch/core/; cd /scratch/core; mvn -o -B -ntp -Daether.syncContext.named.factory=noop -Dmaven.repo.local=/m2 -Dsiare.test.pdf=/input.pdf verify' `
    2>&1 | Tee-Object -FilePath (Join-Path $evidence 'java.log')
if ($LASTEXITCODE -ne 0) { throw 'Falló Maven verify; consulta java.log.' }
Write-Output "Suites documentales completadas. Evidencia: $evidence"
Write-Output 'La integración con GridFS y navegador se ejecuta por separado; este comando no afirma haberla probado.'
