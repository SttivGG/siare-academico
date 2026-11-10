export function healthView(ready: boolean) {
  return { service: "progress-api", status: ready ? "UP" : "DOWN" };
}
