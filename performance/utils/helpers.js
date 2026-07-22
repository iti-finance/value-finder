/**
 * Small reusable wait helper.
 */

export async function sleep(page, milliseconds = 1000) {
  await page.waitForTimeout(milliseconds);
}
