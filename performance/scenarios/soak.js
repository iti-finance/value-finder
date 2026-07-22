import { sleep } from "k6";

import { getHealth } from "../utils/http.js";

export const options = {
  stages: [
    { duration: "2m", target: 10 },
    { duration: "1h", target: 10 },
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<750"],
  },
};

export default function () {
  getHealth();
  sleep(1);
}
