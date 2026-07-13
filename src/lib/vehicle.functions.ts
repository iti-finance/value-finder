import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/auth/middleware";
import { db } from "@/integrations/db/client.server";

export const getVehicleMakes = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { rows } = await db.query<{ make: string }>(
      `SELECT DISTINCT make FROM vehicle_values ORDER BY make ASC`,
    );
    return { makes: rows.map((r) => r.make) };
  });

export const getVehicleYears = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { rows } = await db.query<{ year: number }>(
      `SELECT DISTINCT year FROM vehicle_values ORDER BY year DESC`,
    );
    return { years: rows.map((r) => r.year) };
  });

export const getVehicleModels = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => z.object({ make: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { rows } = await db.query<{ model: string }>(
      `SELECT DISTINCT model FROM vehicle_values WHERE make = $1 ORDER BY model ASC`,
      [data.make],
    );
    return { models: rows.map((r) => r.model) };
  });

export const getVehicleVariants = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z.object({ make: z.string().min(1), model: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { rows } = await db.query<{ variant: string }>(
      `SELECT DISTINCT variant FROM vehicle_values WHERE make = $1 AND model = $2 ORDER BY variant ASC`,
      [data.make, data.model],
    );
    return { variants: rows.map((r) => r.variant) };
  });

export const searchVehicle = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z
      .object({
        make: z.string().min(1),
        model: z.string().min(1),
        variant: z.string().min(1),
        year: z.number().int(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { rows } = await db.query<{
      make: string;
      model: string;
      variant: string;
      year: number;
      value: string;
    }>(
      `SELECT make, model, variant, year, value
       FROM vehicle_values
       WHERE make = $1 AND model = $2 AND variant = $3 AND year = $4
       LIMIT 1`,
      [data.make, data.model, data.variant, data.year],
    );
    const row = rows[0] ?? null;
    return { row };
  });

export const logAuditEvent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) =>
    z
      .object({
        action: z.string().min(1),
        details: z.any().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await db.query(
      `INSERT INTO audit_logs (user_id, employee_code, action, user_agent, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [context.userId, context.employeeCode, data.action, null, data.details ?? null],
    );
    return { ok: true };
  });

export const getUploadHistory = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { rows } = await db.query<{
      filename: string;
      record_count: number;
      uploaded_at: string;
    }>(
      `SELECT filename, record_count, uploaded_at
       FROM upload_history
       ORDER BY uploaded_at DESC
       LIMIT 10`,
    );
    return { history: rows };
  });

export const getPasswordResetRequests = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { rows } = await db.query<{
      id: string;
      employee_code: string;
      requested_at: string;
      status: string;
    }>(
      `SELECT id, employee_code, requested_at, status
       FROM password_reset_requests
       ORDER BY requested_at DESC
       LIMIT 50`,
    );
    return { requests: rows };
  });

export const getAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => z.object({ action: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const params: unknown[] = [];
    let sql = `SELECT id, user_id, employee_code, action, user_agent, ip, details, created_at
               FROM audit_logs`;
    if (data.action && data.action !== "all") {
      sql += ` WHERE action = $1`;
      params.push(data.action);
    }
    sql += ` ORDER BY created_at DESC LIMIT 200`;
    const { rows } = await db.query<{
      id: string;
      user_id: string | null;
      employee_code: string | null;
      action: string;
      user_agent: string | null;
      ip: string | null;
      details: unknown;
      created_at: string;
    }>(sql, params);
    return { logs: rows };
  });
