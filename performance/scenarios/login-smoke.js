import { config } from "../config/env.js";
import { createPage, closePage } from "../utils/browser.js";
import { LoginPage } from "../pages/login.page.js";
import { verifyUrl } from "../utils/checks.js";

export const options = {
  scenarios: {
    login_smoke: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      options: { browser: { type: "chromium" } },
    },
  },
};

export default async function () {
  if (!config.users.admin.email || !config.users.admin.password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set for smoke:browser.");
  }

  const page = await createPage();
  try {
    const login = new LoginPage(page);
    await login.open();
    await login.loginAsAdmin(config.users.admin.email, config.users.admin.password);
    await login.waitForAdminDashboard();
    verifyUrl(page, "/admin");
  } finally {
    await closePage(page);
  }
}
