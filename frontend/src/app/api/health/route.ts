import { getCoreHealth } from "../../../lib/server-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const core = await getCoreHealth();
  return Response.json({ service: "frontend", status: core.status }, {
    status: core.status === "UP" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
