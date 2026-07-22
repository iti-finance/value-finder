import { browser } from "k6/browser";
import { config } from "../config/env.js";

export async function createPage() {
  const page = await browser.newPage();
  page.setDefaultTimeout(config.browser.timeout);
  return page;
}

export async function closePage(page) {
  if (page) {
    await page.close();
  }
}
