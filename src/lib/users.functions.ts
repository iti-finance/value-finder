import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { requireAuth } from "@/integrations/auth/middleware";
import { hashPassword } from "@/integrations/auth/password.server";
import { db } from "@/integrations/db/client.server";
import { z } from "zod";

const EMAIL_DOMAIN = "iti.local";
const codeToEmail = (code: string) => `${code.trim().toLowerCase()}@${EMAIL_DOMAIN}`;

const CreateUserSchema = z.object({
  employee_code: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, "Only letters, numbers, _ and -"),
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  role: z.enum(["admin", "branch"]),
});

async function assertAdmin(userId: string) {
  const { rows } = await db.query<{ role: string }>(
    `SELECT role FROM user_roles WHERE user_id = $1`,
    [userId],
  );
  if (!rows?.some((r) => r.role === "admin")) {
    throw new Error("Forbidden");
  }
}

export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    CreateUserSchema.omit({ role: true, email: true })
      .extend({
        email: z.string().trim().email().max(255),
        password: z.string().min(6).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { rows } = await db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM user_roles WHERE role = 'admin'`,
    );
    if ((rows[0]?.count ?? 0) > 0) {
      throw new Error("Setup already complete");
    }

    const passwordHash = await hashPassword(data.password);
    const userId = randomUUID();
    await db.query(
      `INSERT INTO profiles (user_id, employee_code, full_name, email, password_hash, is_active)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [userId, data.employee_code, data.full_name, data.email.toLowerCase(), passwordHash],
    );
    await db.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')`, [userId]);
    return { ok: true };
  });

export const adminBootstrapStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { rows } = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM user_roles WHERE role = 'admin'`,
  );
  return { needsBootstrap: (rows[0]?.count ?? 0) === 0 };
});

export const resolveLoginEmail = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ employee_code: z.string().trim().min(1).max(50) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { rows } = await db.query<{ email: string | null; is_active: boolean }>(
      `SELECT email, is_active FROM profiles WHERE lower(employee_code) = lower($1) LIMIT 1`,
      [data.employee_code],
    );
    const user = rows[0];
    if (!user) return { email: null as string | null, reason: "not_found" as const };
    if (!user.is_active) return { email: null, reason: "inactive" as const };
    return { email: user.email, reason: "ok" as const };
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    CreateUserSchema.extend({ password: z.string().min(4).max(128).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.role === "admin" && !data.email) {
      throw new Error("Email is required for administrator accounts");
    }

    const userId = randomUUID();
    const password =
      data.password && data.password.length >= 4 ? data.password : data.employee_code;
    const passwordHash = await hashPassword(password);
    const email = data.email ? data.email.toLowerCase() : null;

    await db.query(
      `INSERT INTO profiles (user_id, employee_code, full_name, email, password_hash, is_active)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [userId, data.employee_code, data.full_name, email, passwordHash],
    );
    await db.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`, [userId, data.role]);

    return { ok: true, user_id: userId };
  });

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const { rows } = await db.query<{
      user_id: string;
      employee_code: string;
      full_name: string;
      email: string | null;
      is_active: boolean;
      role: string | null;
      created_at: string;
    }>(
      `SELECT p.user_id, p.employee_code, p.full_name, p.email, p.is_active, r.role, p.created_at
       FROM profiles p
       LEFT JOIN user_roles r ON r.user_id = p.user_id
       ORDER BY p.created_at DESC`,
    );
    return rows.map((r) => ({
      user_id: r.user_id,
      employee_code: r.employee_code,
      full_name: r.full_name,
      email: r.email,
      is_active: r.is_active,
      role: r.role ?? "branch",
      created_at: r.created_at,
    }));
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z.object({ user_id: z.string().uuid(), is_active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await db.query(`UPDATE profiles SET is_active = $1 WHERE user_id = $2`, [
      data.is_active,
      data.user_id,
    ]);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("Cannot delete yourself");
    await db.query(`DELETE FROM user_roles WHERE user_id = $1`, [data.user_id]);
    await db.query(`DELETE FROM profiles WHERE user_id = $1`, [data.user_id]);
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z
      .object({ user_id: z.string().uuid(), password: z.string().min(4).max(128).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { rows } = await db.query<{ employee_code: string }>(
      `SELECT employee_code FROM profiles WHERE user_id = $1 LIMIT 1`,
      [data.user_id],
    );
    const user = rows[0];
    if (!user) throw new Error("User not found");

    const newPassword =
      data.password && data.password.length >= 4 ? data.password : user.employee_code;
    const passwordHash = await hashPassword(newPassword);
    await db.query(`UPDATE profiles SET password_hash = $1 WHERE user_id = $2`, [
      passwordHash,
      data.user_id,
    ]);
    return { ok: true, password: newPassword };
  });

const BulkUserRow = CreateUserSchema.extend({
  password: z.string().min(4).max(128).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  role: z.enum(["admin", "branch"]).optional(),
});

export const bulkCreateUsers = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z
      .object({
        rows: z
          .array(
            z.object({
              employee_code: z.string().trim().min(1).max(50),
              full_name: z.string().trim().min(1).max(120),
              email: z.string().trim().max(255).optional().or(z.literal("")),
              role: z.string().trim().optional(),
              password: z.string().trim().max(128).optional().or(z.literal("")),
            }),
          )
          .min(1)
          .max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const results: Array<{
      employee_code: string;
      status: "created" | "failed";
      message?: string;
    }> = [];

    for (const raw of data.rows) {
      try {
        const parsed = BulkUserRow.parse({
          employee_code: raw.employee_code,
          full_name: raw.full_name,
          email: raw.email ?? "",
          role: raw.role?.toLowerCase() === "admin" ? "admin" : "branch",
          password: raw.password ?? "",
        });
        if (parsed.role === "admin" && !parsed.email) {
          throw new Error("Email is required for administrator accounts");
        }
        const password =
          parsed.password && parsed.password.length >= 4 ? parsed.password : parsed.employee_code;
        const passwordHash = await hashPassword(password);
        const userId = randomUUID();
        const email = parsed.email ? parsed.email.toLowerCase() : null;

        await db.query(
          `INSERT INTO profiles (user_id, employee_code, full_name, email, password_hash, is_active)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [userId, parsed.employee_code, parsed.full_name, email, passwordHash],
        );
        await db.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`, [
          userId,
          parsed.role,
        ]);
        results.push({ employee_code: parsed.employee_code, status: "created" });
      } catch (e) {
        results.push({
          employee_code: raw.employee_code,
          status: "failed",
          message: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    const created = results.filter((r) => r.status === "created").length;
    const failed = results.length - created;
    return { created, failed, results };
  });

export const resolvePasswordResetRequest = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["resolved", "rejected"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await db.query(
      `UPDATE password_reset_requests
       SET status = $1,
           resolved_at = $2,
           resolved_by = $3
       WHERE id = $4`,
      [data.status, new Date().toISOString(), context.userId, data.id],
    );
    return { ok: true };
  });

/**
 * Publicly callable: submit a password reset request by employee code.
 * Always returns ok=true (no enumeration), but only persists a row when
 * the employee code belongs to an active profile.
 */
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
    // Always return success to prevent enumeration of valid employee codes.
    return { ok: true };
  });
