import "server-only";
import { checkCoreHealth } from "./core-health";

export function getCoreHealth() {
  return checkCoreHealth(process.env.CORE_API_URL);
}
