import { check } from "k6";

/**
 * Verify current URL ends with the expected path.
 */
export function verifyUrl(page, expectedPath) {
  return check(page, {
    [`Current URL ends with '${expectedPath}'`]: () => page.url().endsWith(expectedPath),
  });
}
