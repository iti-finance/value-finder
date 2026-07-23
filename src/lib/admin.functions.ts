import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/auth/middleware";
import { z } from "zod";
import { db } from "@/integrations/db/client.server";
import { hashPassword } from "@/integrations/auth/password.server";

const RowSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  variant: z.string().min(1),
  year: z.number().int(),
  value: z.number(),
});

const UploadSchema = z.object({
  filename: z.string().min(1).max(255),
  rows: z.array(RowSchema).min(1),
});

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { rows } = await db.query<{ role: string }>(
      `SELECT role FROM user_roles WHERE user_id = $1`,
      [context.userId],
    );
    return { isAdmin: rows?.some((r) => r.role === "admin") };
  });

export const replaceVehicleData = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => UploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    await db.withTransaction(async (client) => {
      await client.query(`DELETE FROM vehicle_values`);

      const BATCH = 1000;
      for (let i = 0; i < data.rows.length; i += BATCH) {
        const batch = data.rows.slice(i, i + BATCH);
        const params: Array<string | number> = [];

        const valuesSql = batch
          .map((r, idx) => {
            const base = idx * 5;
            params.push(r.make, r.model, r.variant, r.year, r.value);

            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
          })
          .join(",");

        const sql = `INSERT INTO vehicle_values (make, model, variant, year, value) VALUES ${valuesSql}`;

        await client.query(sql, params);
      }

      await client.query(
        `INSERT INTO upload_history (uploaded_by, filename, record_count) VALUES ($1, $2, $3)`,
        [context.userId, data.filename, data.rows.length],
      );
    });

    return { ok: true, count: data.rows.length };
  });

export const promoteSelfToAdminIfEmpty = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { rows } = await db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM user_roles WHERE role = 'admin'`,
    );
    if ((rows[0]?.count ?? 0) > 0) return { promoted: false };
    await db.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')`, [context.userId]);
    return { promoted: true };
  });

async function assertAdmin(userId: string) {
  const { rows } = await db.query<{ role: string }>(
    `SELECT role FROM user_roles WHERE user_id = $1`,
    [userId],
  );
  if (!rows?.some((r) => r.role === "admin")) {
    throw new Error("Forbidden: admin access required");
  }
}

export const deleteAuditLog = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await db.query(`DELETE FROM audit_logs WHERE id = $1`, [data.id]);
    return { ok: true };
  });

export const clearAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => z.object({ action: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let result;
    if (data.action && data.action !== "all") {
      result = await db.query(`DELETE FROM audit_logs WHERE action = $1`, [data.action]);
    } else {
      result = await db.query(`DELETE FROM audit_logs`);
    }
    return { ok: true, deleted: result.rowCount ?? 0 };
  });

export const changeOwnPassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => z.object({ password: z.string().min(4).max(128) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const passwordHash = await hashPassword(data.password);
    await db.query(`UPDATE profiles SET password_hash = $1 WHERE user_id = $2`, [
      passwordHash,
      context.userId,
    ]);
    return { ok: true };
  });
