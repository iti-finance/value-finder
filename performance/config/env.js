export const config = {
  baseUrl: __ENV.BASE_URL || "http://localhost:3001",

  healthPath: __ENV.HEALTH_PATH || "/api/health",

  testVehicle: {
    make: __ENV.TEST_VEHICLE_MAKE || "",
    model: __ENV.TEST_VEHICLE_MODEL || "",
    variant: __ENV.TEST_VEHICLE_VARIANT || "",
    year: __ENV.TEST_VEHICLE_YEAR || "",
  },

  users: {
    admin: {
      email: __ENV.ADMIN_EMAIL || "",
      password: __ENV.ADMIN_PASSWORD || "",
    },

    branch: {
      employeeCode: __ENV.BRANCH_EMPLOYEE_CODE || "",
      password: __ENV.BRANCH_PASSWORD || "",
    },
  },

  browser: {
    timeout: Number(__ENV.BROWSER_TIMEOUT || 30000),
    headless: (__ENV.HEADLESS ?? "true") === "true",
  },
};
