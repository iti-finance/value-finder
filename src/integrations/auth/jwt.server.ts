import jwt, { type SignOptions } from "jsonwebtoken";
import { getServerConfig } from "@/lib/config.server";

const config = getServerConfig();

if (!config.jwt.secret) {
  throw new Error("Missing JWT_SECRET environment variable");
}

/**
 * JWT Configuration
 */
const JWT_OPTIONS: SignOptions = {
  algorithm: "HS256",
  expiresIn: config.jwt.expiresIn,
};

/**
 * Payload stored inside JWT
 */
export type AuthTokenPayload = {
  userId: string;
  role: "admin" | "branch";
  employeeCode: string;
  fullName: string;
};

/**
 * Generate JWT
 */
export function signJwt(payload: AuthTokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, JWT_OPTIONS);
}

/**
 * Verify JWT
 */
export function verifyJwt(token: string): AuthTokenPayload {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);

    if (
      typeof decoded === "object" &&
      decoded !== null &&
      "userId" in decoded &&
      "role" in decoded &&
      "employeeCode" in decoded &&
      "fullName" in decoded
    ) {
      return decoded as AuthTokenPayload;
    }

    throw new Error("Invalid token payload");
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Authentication token has expired");
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid authentication token");
    }

    throw error;
  }
}
