#!/bin/bash
set -e
clickhouse-client --host 127.0.0.1 --user "$CLICKHOUSE_USER" --password "$CLICKHOUSE_PASSWORD" \
  --database "$CLICKHOUSE_DB" --multiquery < /opt/siare/10-academic.sql
