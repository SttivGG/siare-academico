[CmdletBinding()]
param()

. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-SiareDocker
Assert-SiareOwnership
$volume = "${script:SiareProject}_jwt-keys"
Assert-SiareVolume $volume
# Only this project's dedicated key volume is mounted. Keys never enter the repository or image.
$generator = @'
const fs = require('node:fs');
const crypto = require('node:crypto');
const priv = '/keys/private.pem', pub = '/keys/public.pem';
if (fs.existsSync(priv) !== fs.existsSync(pub)) throw Error('Par de claves incompleto; recupera el respaldo, no se sobrescribira.');
if (!fs.existsSync(priv)) {
  const pair = crypto.generateKeyPairSync('rsa', {modulusLength:3072, publicKeyEncoding:{type:'spki',format:'pem'}, privateKeyEncoding:{type:'pkcs8',format:'pem'}});
  fs.writeFileSync(priv, pair.privateKey, {flag:'wx', mode:0o400});
  fs.writeFileSync(pub, pair.publicKey, {flag:'wx', mode:0o400});
}
for (const path of [priv,pub]) { fs.chownSync(path,10001,10001); fs.chmodSync(path,0o400); }
console.log('OK: claves RSA persistentes preparadas; no se expuso su contenido.');
'@
& docker run --rm --network none --mount "type=volume,source=$volume,target=/keys" node:24.22.2-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 node -e $generator
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron preparar las claves RSA.' }
