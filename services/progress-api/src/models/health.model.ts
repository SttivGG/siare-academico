import cassandra from "cassandra-driver";

export interface HealthModel {
  isReady(): Promise<boolean>;
}

export function createCassandraHealthModel() {
  const client = new cassandra.Client({
    contactPoints: [process.env.CASSANDRA_HOST ?? "cassandra"],
    localDataCenter: process.env.CASSANDRA_DATACENTER ?? "datacenter1",
    socketOptions: { connectTimeout: 3000, readTimeout: 5000 },
    pooling: { coreConnectionsPerHost: { [cassandra.types.distance.local]: 1 } },
    queryOptions: { consistency: cassandra.types.consistencies.localOne },
  });
  const model: HealthModel = {
    async isReady() {
      try {
        const result = await client.execute("SELECT release_version FROM system.local");
        return result.rowLength === 1;
      } catch {
        console.warn("Readiness check failed: cassandra");
        return false;
      }
    },
  };
  return { model, close: () => client.shutdown() };
}
