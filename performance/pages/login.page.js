import { config } from "../config/env.js";

async function waitForPath(page, expectedPath) {
  const deadline = Date.now() + config.browser.timeout;

  while (Date.now() < deadline) {
    const pathname = page
      .url()
      .replace(/^https?:\/\/[^/]+/, "")
      .split(/[?#]/)[0];
    if (pathname === expectedPath) {
      return;
    }
    await page.waitForTimeout(100);
  }

  throw new Error(`Timed out waiting for '${expectedPath}'. Current URL: ${page.url()}`);
}

export class LoginPage {
  constructor(page) {
    this.page = page;
  }

  async open() {
    await this.page.goto(`${config.baseUrl}/auth`);
  }

  async loginAsAdmin(email, password) {
    await this.page
      .getByRole("tab", {
        name: "Administrator",
      })
      .click();

    await this.page.locator("#admin_email").fill(email);

    await this.page.locator("#password").fill(password);

    await this.page
      .getByRole("button", {
        name: "Login",
      })
      .click();
  }

  async loginAsBranch(employeeCode, password) {
    await this.page
      .getByRole("tab", {
        name: "Branch User",
      })
      .click();

    await this.page.locator("#employee_code").fill(employeeCode);

    await this.page.locator("#password").fill(password);

    await this.page
      .getByRole("button", {
        name: "Login",
      })
      .click();
  }

  async waitForAdminDashboard() {
    await waitForPath(this.page, "/admin");
  }

  async waitForBranchDashboard() {
    await waitForPath(this.page, "/value-finder");
  }
}
