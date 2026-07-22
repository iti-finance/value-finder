import http from "k6/http";
import { check } from "k6";

import { config } from "../config/env.js";

/**
 * Exercises a dependency-free endpoint so the default load suite is safe to
 * run repeatedly and does not create or mutate business data.
 */
export function getHealth() {
  const response = http.get(`${config.baseUrl}${config.healthPath}`, {
    tags: { name: "health" },
  });

  check(response, {
    "health endpoint returns 200": (res) => res.status === 200,
    "health endpoint reports UP": (res) => {
      try {
        return res.json("status") === "UP";
      } catch {
        return false;
      }
    },
  });

  return response;
}
