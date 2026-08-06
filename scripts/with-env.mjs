import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { config as loadEnv } from "dotenv";

const [, , envFile, ...commandParts] = process.argv;

if (!envFile || commandParts.length === 0) {
  console.error("Usage: node scripts/with-env.mjs <env-file> <command> [args...]");
  process.exit(1);
}

const envPath = resolve(process.cwd(), envFile);

if (!existsSync(envPath)) {
  console.error(`Env file not found: ${envPath}`);
  process.exit(1);
}

loadEnv({ path: envPath, override: true });

const [rawCommand, ...rawArgs] = commandParts;

function resolveCommand(command, args) {
  if (command === "node") {
    return {
      command: process.execPath,
      args,
    };
  }

  if (command === "vite") {
    return {
      command: process.execPath,
      args: [resolve(process.cwd(), "node_modules/vite/bin/vite.js"), ...args],
    };
  }

  return {
    command,
    args,
  };
}

const { command, args } = resolveCommand(rawCommand, rawArgs);
const child = spawn(command, args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
