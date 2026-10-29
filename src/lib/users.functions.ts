import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { requireAuth } from "@/integrations/auth/middleware";
import { hashPassword } from "@/integrations/auth/password.server";
import { db } from "@/integrations/db/client.server";
import { z } from "zod";

const CreateUserSchema = z.object({
  employee_code: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, "Only letters, numbers, _ and -"),
  full_name: z.string().trim().min(1).max(120),
  designation: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  role: z.enum(["admin", "branch"]),
});

function resolvePasswordCandidate(candidate: unknown, fallback: string) {
  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    if (trimmed.length >= 4) return trimmed;
  }

  return fallback.trim();
}

function formatDesignation(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(^|[\s/-])([a-z])/g, (_, separator: string, letter: string) => {
      return `${separator}${letter.toUpperCase()}`;
    });
}

async function resolveDesignation(candidate: string | undefined) {
  const formatted = formatDesignation(candidate ?? "");
  if (!formatted) return null;

  const { rows } = await db.query<{ designation: string }>(
    `SELECT designation
     FROM profiles
     WHERE designation IS NOT NULL AND lower(designation) = lower($1)
     LIMIT 1`,
    [formatted],
  );

  return formatDesignation(rows[0]?.designation ?? formatted);
}

async function assertAdmin(userId: string) {
  const { rows } = await db.query<{ role: string }>(
    `SELECT role FROM user_roles WHERE user_id = $1`,
    [userId],
  );
  if (!rows?.some((r) => r.role === "admin")) {
    throw new Error("Forbidden");
  }
}

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
    const password = resolvePasswordCandidate(data.password, data.employee_code);
    const passwordHash = await hashPassword(password);
    const email = data.email ? data.email.toLowerCase() : null;
    const designation = await resolveDesignation(data.designation);

    await db.query(
      `INSERT INTO profiles
         (user_id, employee_code, full_name, designation, email, password_hash, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [userId, data.employee_code, data.full_name, designation, email, passwordHash],
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
      designation: string | null;
      email: string | null;
      is_active: boolean;
      role: string | null;
      created_at: string;
    }>(
      `SELECT p.user_id, p.employee_code, p.full_name, p.designation, p.email,
              p.is_active, r.role, p.created_at
       FROM profiles p
       LEFT JOIN user_roles r ON r.user_id = p.user_id
       ORDER BY p.created_at DESC`,
    );
    return rows.map((r) => ({
      user_id: r.user_id,
      employee_code: r.employee_code,
      full_name: r.full_name,
      designation: r.designation,
      email: r.email,
      is_active: r.is_active,
      role: r.role ?? "branch",
      created_at: r.created_at,
    }));
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        full_name: z.string().trim().min(1).max(120),
        designation: z.string().trim().max(120).optional().or(z.literal("")),
        email: z.string().trim().email().max(255).optional().or(z.literal("")),
        role: z.enum(["admin", "branch"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.role === "admin" && !data.email) {
      throw new Error("Email is required for administrator accounts");
    }
    if (data.user_id === context.userId && data.role !== "admin") {
      throw new Error("You cannot remove your own administrator role");
    }

    const designation = await resolveDesignation(data.designation);
    const email = data.email ? data.email.toLowerCase() : null;

    await db.withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE profiles
         SET full_name = $1, designation = $2, email = $3
         WHERE user_id = $4`,
        [data.full_name, designation, email, data.user_id],
      );
      if (result.rowCount === 0) throw new Error("User not found");

      await client.query(
        `INSERT INTO user_roles (user_id, role)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role`,
        [data.user_id, data.role],
      );
    });

    return { ok: true };
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
    if (data.user_id === context.userId) throw new Error("Cannot deactivate yourself");

    // Kept as a compatibility endpoint for older deployed clients. Users are
    // never physically deleted; a delete request is treated as deactivation.
    await db.query(`UPDATE profiles SET is_active = false WHERE user_id = $1`, [data.user_id]);
    return { ok: true, deactivated: true };
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

    const newPassword = resolvePasswordCandidate(data.password, user.employee_code);
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
              designation: z.string().trim().max(120).optional().or(z.literal("")),
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
          designation: raw.designation ?? "",
          email: raw.email ?? "",
          role: raw.role?.toLowerCase() === "admin" ? "admin" : "branch",
          password: raw.password ?? "",
        });
        if (parsed.role === "admin" && !parsed.email) {
          throw new Error("Email is required for administrator accounts");
        }
        const password = resolvePasswordCandidate(parsed.password, parsed.employee_code);
        const passwordHash = await hashPassword(password);
        const userId = randomUUID();
        const email = parsed.email ? parsed.email.toLowerCase() : null;
        const designation = await resolveDesignation(parsed.designation);

        await db.query(
          `INSERT INTO profiles
             (user_id, employee_code, full_name, designation, email, password_hash, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [userId, parsed.employee_code, parsed.full_name, designation, email, passwordHash],
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
