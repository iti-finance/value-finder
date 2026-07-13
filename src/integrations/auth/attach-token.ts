import { createMiddleware } from "@tanstack/react-start";
import { AUTH_HEADER, AUTH_TOKEN_KEY, TOKEN_PREFIX } from "./constants";

export const attachAuthToken = createMiddleware({ type: "function" }).client(async ({ next }) => {
  if (typeof window === "undefined") {
    return next();
  }

  const token = window.localStorage.getItem(AUTH_TOKEN_KEY)?.trim();

  return next({
    headers:
      token && token.length > 0
        ? {
            [AUTH_HEADER]: `${TOKEN_PREFIX} ${token}`,
          }
        : {},
  });
});
