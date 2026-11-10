#!/usr/bin/env bash
set -euo pipefail
# Adjust the upstream config inside this container; do not mount a host data directory.
conf=/etc/cassandra/cassandra.yaml
set_option() {
  local key="$1" value="$2"
  if ! grep -Eq "^#? *${key}:" "$conf"; then
    echo "Missing Cassandra option: ${key}" >&2
    exit 1
  fi
  sed -ri "s|^#? *${key}:.*|${key}: ${value}|" "$conf"
}
set_option concurrent_reads 2
set_option concurrent_writes 2
set_option concurrent_counter_writes 2
set_option concurrent_materialized_view_writes 2
set_option concurrent_compactors 1
set_option memtable_heap_space 128MiB
set_option memtable_offheap_space 64MiB
set_option file_cache_size 64MiB
set_option compaction_throughput 16MiB/s
exec /usr/local/bin/docker-entrypoint.sh "$@"
