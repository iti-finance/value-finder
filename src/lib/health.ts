import { db } from "@/integrations/db/client.server";

const APP_VERSION = "1.1.0";

export async function checkReadiness() {
  const timestamp = new Date().toISOString();

  try {
    await db.query("SELECT 1");

    return {
      status: "UP",
      application: "Value Finder",
      database: "UP",
      timestamp,
      version: APP_VERSION,
    };
  } catch (error) {
    return {
      status: "DOWN",
      application: "Value Finder",
      database: "DOWN",
      timestamp,
      version: APP_VERSION,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function checkLiveness() {
  return {
    status: "UP",
    application: "Value Finder",
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
  };
}
