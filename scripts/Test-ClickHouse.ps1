[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'Common.ps1')
# Connectivity from Express's network namespace and runtime, with real SQL and authentication.
# This probe does not provide ingestion, an analytics API or a business readiness claim.
$probe = @'
const assert = require('node:assert/strict');
(async () => {
  const url = new URL(process.env.CLICKHOUSE_URL);
  url.searchParams.set('database', process.env.CLICKHOUSE_DB);
  const response = await fetch(url, {method:'POST', signal:AbortSignal.timeout(10000),
    headers:{'X-ClickHouse-User':process.env.CLICKHOUSE_USER,'X-ClickHouse-Key':process.env.CLICKHOUSE_PASSWORD},
    body:'SELECT 1 AS connected, (SELECT count() FROM system.tables WHERE database = currentDatabase() AND name = \'academic_events\') AS schema_ready FORMAT JSONEachRow'});
  assert.equal(response.status,200,'ClickHouse SQL failed');
  const row = JSON.parse(await response.text());
  assert.equal(Number(row.connected),1); assert.equal(Number(row.schema_ready),1);
  const denied = await fetch(url,{method:'POST',signal:AbortSignal.timeout(10000),
    headers:{'X-ClickHouse-User':process.env.CLICKHOUSE_USER,'X-ClickHouse-Key':'invalid-synthetic-credential'},body:'SELECT 1'});
  assert.equal(denied.status,403,'Invalid ClickHouse credential must be rejected');
  console.log('OK Express -> ClickHouse: authenticated SELECT 1, academic schema, invalid credential rejected; ingestion pending.');
})().catch(() => { console.error('ClickHouse connectivity/schema probe failed'); process.exit(1); });
'@
Invoke-SiareCompose exec -T progress-api node -e $probe
