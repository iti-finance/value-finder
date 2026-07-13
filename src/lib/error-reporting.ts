/**
 * Centralized application error reporting.
 *
 * Currently logs errors to the browser console.
 * In future this can be integrated with:
 *   - Sentry
 *   - Azure Application Insights
 *   - Datadog
 *   - Elastic APM
 *   - Custom logging API
 */

export type ErrorSeverity = "error" | "warning" | "info";

export interface ErrorContext {
  [key: string]: unknown;
}

export function reportError(
  error: unknown,
  context: ErrorContext = {},
  severity: ErrorSeverity = "error",
): void {
  if (typeof window === "undefined") {
    console.error("[Server]", error, context);
    return;
  }

  console.groupCollapsed(`%cApplication ${severity.toUpperCase()}`, "color:red;font-weight:bold;");

  console.error(error);

  console.table({
    Route: window.location.pathname,
    Timestamp: new Date().toISOString(),
    Severity: severity,
    ...context,
  });

  console.groupEnd();

  /*
   * Future integration example:
   *
   * Sentry.captureException(error, {
   *   extra: context,
   *   level: severity,
   * });
   */
}
