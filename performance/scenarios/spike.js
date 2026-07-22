import { sleep } from "k6";

import { getHealth } from "../utils/http.js";

export const options = {
  stages: [
    { duration: "15s", target: 5 },
    { duration: "10s", target: 50 },
    { duration: "1m", target: 50 },
    { duration: "15s", target: 5 },
    { duration: "15s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2000"],
  },
};

export default function () {
  getHealth();
  sleep(1);
}
