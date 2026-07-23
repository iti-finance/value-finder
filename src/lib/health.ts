import { db } from "@/integrations/db/client.server";

export async function checkReadiness() {
  const timestamp = new Date().toISOString();

  try {
    await db.query("SELECT 1");

    return {
      status: "UP",
      application: "Value Finder",
      database: "UP",
      timestamp,
      version: "1.0.0",
    };
  } catch (error) {
    return {
      status: "DOWN",
      application: "Value Finder",
      database: "DOWN",
      timestamp,
      version: "1.0.0",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function checkLiveness() {
  return {
    status: "UP",
    application: "Value Finder",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  };
}
