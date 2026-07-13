import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { signJwt, type AuthTokenPayload } from "@/integrations/auth/jwt.server";
import { hashPassword, verifyPassword } from "@/integrations/auth/password.server";
import { db } from "@/integrations/db/client.server";

const LoginInputSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(4),
  mode: z.enum(["branch", "admin"]),
});

export const login = createServerFn({ method: "POST" })
  .validator((input: unknown) => LoginInputSchema.parse(input))
  .handler(async ({ data }) => {
    const identifier = data.identifier.toLowerCase();
    const userRow = await db.query<{
      user_id: string;
      password_hash: string;
      employee_code: string;
      full_name: string;
      role: "admin" | "branch";
      is_active: boolean;
      email: string | null;
    }>(
      `SELECT p.user_id, p.password_hash, p.employee_code, p.full_name, u.role, p.is_active, p.email
       FROM profiles p
       JOIN user_roles u ON u.user_id = p.user_id
       WHERE ${data.mode === "admin" ? "lower(p.email) = $1" : "lower(p.employee_code) = $1"}
       LIMIT 1`,
      [identifier],
    );
    const row = userRow.rows[0];
    if (!row || !row.is_active) {
      throw new Error("Invalid credentials");
    }
    const valid = await verifyPassword(data.password, row.password_hash);
    if (!valid) {
      throw new Error("Invalid credentials");
    }
    const payload: AuthTokenPayload = {
      userId: row.user_id,
      role: row.role,
      employeeCode: row.employee_code,
      fullName: row.full_name,
    };
    const token = signJwt(payload);
    return {
      token,
      user: {
        userId: row.user_id,
        role: row.role,
        employeeCode: row.employee_code,
        fullName: row.full_name,
      },
    };
  });

export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        employee_code: z
          .string()
          .trim()
          .min(2)
          .max(50)
          .regex(/^[A-Za-z0-9_-]+$/),
        full_name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(255),
        password: z.string().min(6).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { rows } = await db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM user_roles WHERE role = 'admin'`,
    );
    if (rows[0].count > 0) {
      throw new Error("Setup already complete");
    }
    const passwordHash = await hashPassword(data.password);
    const { rows: inserted } = await db.query<{ user_id: string }>(
      `INSERT INTO profiles (employee_code, full_name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id`,
      [data.employee_code, data.full_name, data.email, passwordHash],
    );
    const userId = inserted[0].user_id;
    await db.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')`, [userId]);
    return { ok: true };
  });

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ employee_code: z.string().trim().min(2).max(50) }).parse(input),
  )
  .handler(async ({ data }) => {
    const code = data.employee_code.trim();
    const { rows } = await db.query<{ employee_code: string }>(
      `SELECT employee_code FROM profiles WHERE lower(employee_code) = lower($1) AND is_active = true LIMIT 1`,
      [code],
    );
    if (rows[0]) {
      await db.query(`INSERT INTO password_reset_requests (employee_code) VALUES ($1)`, [
        rows[0].employee_code,
      ]);
    }
    return { ok: true };
  });

export const adminBootstrapStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { rows } = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
       FROM user_roles
       WHERE role = 'admin'`,
  );

  return {
    needsBootstrap: rows[0].count === 0,
  };
});
