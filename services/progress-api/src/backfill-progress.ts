import type cassandra from "cassandra-driver";
import { parseAttemptEvent } from "./models/attempt-event.js";
import { createCassandraHealthModel } from "./models/health.model.js";
import { createCassandraProgressModel } from "./models/progress.model.js";

const { client, close } = createCassandraHealthModel();
const progress = createCassandraProgressModel(client);

try {
  let count = 0;
  let pageState: cassandra.QueryOptions["pageState"];
  do {
    const result = await client.execute("SELECT payload FROM siare_progress.attempts", [], { fetchSize: 100, pageState });
    for (const row of result.rows) {
      const event = parseAttemptEvent(JSON.parse(row.payload));
      if (!event) throw new Error("Unexpected historical attempt format");
      await progress.apply(event);
      count++;
    }
    pageState = result.pageState ?? undefined;
  } while (pageState);
  console.log("Progress backfill processed " + count + " attempt(s).");
} catch {
  console.error("Progress backfill did not complete. Rerun it after checking Cassandra.");
  process.exitCode = 1;
} finally {
  await close();
}
