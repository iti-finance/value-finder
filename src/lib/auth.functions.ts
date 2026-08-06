import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
