import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { verifyJwt, type AuthTokenPayload } from "./jwt.server";
import { db } from "@/integrations/db/client.server";

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized: missing authorization token");
  }
  const token = authHeader.slice(7);
  let payload: AuthTokenPayload;
  try {
    payload = verifyJwt(token);
  } catch {
    throw new Error("Unauthorized: invalid token");
  }

  const { rows } = await db.query<{ user_id: string; is_active: boolean }>(
    `SELECT p.user_id, p.is_active
       FROM profiles p
       WHERE p.user_id = $1`,
    [payload.userId],
  );
  const user = rows[0];
  if (!user || !user.is_active) {
    throw new Error("Unauthorized: user not active");
  }

  return next({
    context: {
      userId: payload.userId,
      role: payload.role,
      employeeCode: payload.employeeCode,
      fullName: payload.fullName,
    },
  });
});
