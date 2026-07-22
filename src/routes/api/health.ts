import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          status: "UP",
          application: "Value Finder",
          version: "1.0.0",
          timestamp: new Date().toISOString(),
        });
      },
    },
  },
});