import { execSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

if (!databaseUrl.startsWith("libsql:")) {
  console.log("Skipping prisma db push (DATABASE_URL is not libsql://).");
  process.exit(0);
}

if (!process.env.DATABASE_AUTH_TOKEN?.trim()) {
  console.warn(
    "Skipping prisma db push: DATABASE_AUTH_TOKEN is required for libsql://."
  );
  process.exit(0);
}

console.log("Applying Prisma schema to Turso...");
execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
