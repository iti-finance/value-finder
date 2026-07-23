import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hashPassword } from "@/integrations/auth/password.server";
import { db } from "@/integrations/db/client.server";
import { authenticateUser } from "@/integrations/auth/auth.service";

const LoginInputSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(4),
  mode: z.enum(["branch", "admin"]),
});

export const login = createServerFn({ method: "POST" })
  .validator((input: unknown) => LoginInputSchema.parse(input))
  .handler(async ({ data }) => {
    return authenticateUser(data);
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
