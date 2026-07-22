import { sleep } from "k6";

import { getHealth } from "../utils/http.js";

export const options = {
  vus: 1,
  iterations: 5,
  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate==0"],
    http_req_duration: ["p(95)<1000"],
  },
};

export default function () {
  getHealth();
  sleep(1);
}
