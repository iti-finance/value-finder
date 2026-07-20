import { db } from "@/integrations/db/client.server";

export async function checkReadiness() {
  try {
    await db.query("SELECT 1");

    return {
      status: "UP",
      database: "UP",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    };
  } catch (error) {
    return {
      status: "DOWN",
      database: "DOWN",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function checkLiveness() {
  return {
    status: "UP",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  };
}