import { browser } from "k6/browser";

export const options = {
  scenarios: {
    browser: {
      executor: "shared-iterations",
      options: {
        browser: {
          type: "chromium",
        },
      },
    },
  },
};

export default async function () {
  const page = await browser.newPage();

  try {
    await page.goto("https://example.com");
    console.log(await page.title());
  } finally {
    await page.close();
  }
}
