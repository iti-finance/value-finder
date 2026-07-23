import { db } from "@/integrations/db/client.server";
import { verifyPassword } from "@/integrations/auth/password.server";
import { signJwt, type AuthTokenPayload } from "@/integrations/auth/jwt.server";

export type LoginMode = "admin" | "branch";

export interface AuthenticateUserInput {
  identifier: string;
  password: string;
  mode: LoginMode;
}

export interface AuthenticateUserResult {
  token: string;
  user: {
    userId: string;
    role: "admin" | "branch";
    employeeCode: string;
    fullName: string;
  };
}

export async function authenticateUser(
  input: AuthenticateUserInput,
): Promise<AuthenticateUserResult> {
  const identifier = input.identifier.trim().toLowerCase();

  const { rows } = await db.query<{
    user_id: string;
    password_hash: string;
    employee_code: string;
    full_name: string;
    role: "admin" | "branch";
    is_active: boolean;
    email: string | null;
  }>(
    `SELECT
        p.user_id,
        p.password_hash,
        p.employee_code,
        p.full_name,
        u.role,
        p.is_active,
        p.email
     FROM profiles p
     JOIN user_roles u
       ON u.user_id = p.user_id
     WHERE ${input.mode === "admin" ? "lower(p.email) = $1" : "lower(p.employee_code) = $1"}
     LIMIT 1`,
    [identifier],
  );

  const user = rows[0];

  if (!user || !user.is_active) {
    throw new Error("Invalid credentials");
  }

  const valid = await verifyPassword(input.password, user.password_hash);

  if (!valid) {
    throw new Error("Invalid credentials");
  }

  const payload: AuthTokenPayload = {
    userId: user.user_id,
    role: user.role,
    employeeCode: user.employee_code,
    fullName: user.full_name,
  };

  const token = signJwt(payload);

  return {
    token,
    user: {
      userId: user.user_id,
      role: user.role,
      employeeCode: user.employee_code,
      fullName: user.full_name,
    },
  };
}
