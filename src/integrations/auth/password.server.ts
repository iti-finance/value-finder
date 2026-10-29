import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

// Nitro's bundled runtime doesn't always expose the crypto source that bcryptjs
// auto-detects, so we provide one explicitly for server-side salt generation.
bcrypt.setRandomFallback((length) => Array.from(randomBytes(length)));

export async function hashPassword(password: string) {
  if (typeof password !== "string") {
    throw new Error("Password must be a string");
  }

  return bcrypt.hashSync(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compareSync(password, hash);
}
