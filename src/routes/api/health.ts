import { createFileRoute } from "@tanstack/react-router";
import { checkReadiness } from "@/lib/health";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const health = await checkReadiness();

        return Response.json(health, {
          status: health.status === "UP" ? 200 : 503,
        });
      },
    },
  },
});
