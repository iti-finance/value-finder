import { sleep } from "k6";

import { getHealth } from "../utils/http.js";

const concurrentUsers = Number(__ENV.CONCURRENT_USERS || 50);
const requestsPerUser = Number(__ENV.REQUESTS_PER_USER || 4);

export const options = {
  scenarios: {
    concurrent_50x200: {
      executor: "per-vu-iterations",
      vus: concurrentUsers,
      iterations: requestsPerUser,
      maxDuration: "2m",
    },
  },
  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

export default function () {
  getHealth();
  // Keeps each virtual user active long enough for container metrics to be
  // sampled. The scenario makes 50 x 4 = 200 requests in total.
  sleep(1);
}
