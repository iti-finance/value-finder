import { config } from "../config/env.js";
import { createPage, closePage } from "../utils/browser.js";
import { verifyUrl } from "../utils/checks.js";
import { LoginPage } from "../pages/login.page.js";
import { ValueFinderPage } from "../pages/valueFinder.page.js";

const vus = Number(__ENV.WORKFLOW_USERS || 1);
const iterations = Number(__ENV.WORKFLOW_ITERATIONS || 1);

export const options = {
  scenarios: {
    value_finder_workflow: {
      executor: "per-vu-iterations",
      vus,
      iterations,
      maxDuration: "10m",
      options: {
        browser: { type: "chromium" },
      },
    },
  },
  thresholds: {
    checks: ["rate==1"],
    browser_web_vital_lcp: ["p(95)<5000"],
  },
};

export default async function () {
  if (!config.users.branch.employeeCode || !config.users.branch.password) {
    throw new Error(
      "BRANCH_EMPLOYEE_CODE and BRANCH_PASSWORD must be set for the value-finder workflow test.",
    );
  }

  if (Object.values(config.testVehicle).some((value) => !value)) {
    throw new Error(
      "TEST_VEHICLE_MAKE, TEST_VEHICLE_MODEL, TEST_VEHICLE_VARIANT, and TEST_VEHICLE_YEAR must be set to an existing vehicle row.",
    );
  }

  let page;
  try {
    page = await createPage();
    const login = new LoginPage(page);
    await login.open();
    await login.loginAsBranch(config.users.branch.employeeCode, config.users.branch.password);
    await login.waitForBranchDashboard();
    if (!verifyUrl(page, "/value-finder")) {
      throw new Error("Branch login did not reach the Value Finder dashboard.");
    }

    const valueFinder = new ValueFinderPage(page);
    await valueFinder.selectVehicle(config.testVehicle);
    await valueFinder.search();
    check(null, { "value-finder workflow completes": () => true });
  } catch (error) {
    check(null, { "value-finder workflow completes": () => false });
    if (page) {
      console.error("Current URL:", page.url());
      await page.screenshot({ path: `reports/value-finder-failure-${__VU}.png` });
    }
    throw error;
  } finally {
    await closePage(page);
  }
}
import { check } from "k6";
