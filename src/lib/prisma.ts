import { assertResourceEnvironment, securityEnvironment, isHostedRuntime } from "@/lib/security-environment";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function cleanEnv(value: string | undefined): string | undefined {
  return value?.trim().replace(/^["']|["']$/g, "");
}

function resolveDatabaseUrl(): string {
  const configured = cleanEnv(process.env.DATABASE_URL);
  if (configured) return configured;

  if (isHostedRuntime()) {
    throw new Error(
      "DATABASE_URL is not configured. Configure the approved remote database for this hosting environment."
    );
  }

  return "file:./prisma/dev.db";
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl.startsWith("file:") && !databaseUrl.startsWith("libsql:")) throw new Error("Unsupported database provider");
  const environment = securityEnvironment();
  if (!databaseUrl.startsWith("file:")) assertResourceEnvironment("DATABASE");
  if ((environment === "production" || isHostedRuntime()) && databaseUrl.startsWith("file:")) throw new Error("Production database must be remote");

  const log: Prisma.LogLevel[] =
    [];

  if (databaseUrl.startsWith("libsql:")) {
    const authToken = cleanEnv(process.env.DATABASE_AUTH_TOKEN);
    if (!authToken) {
      throw new Error(
        "DATABASE_AUTH_TOKEN is required when using a libsql:// DATABASE_URL."
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSql } = require("@prisma/adapter-libsql") as typeof import("@prisma/adapter-libsql");
    return new PrismaClient({
      adapter: new PrismaLibSql({ url: databaseUrl, authToken }),
      log,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3") as typeof import("@prisma/adapter-better-sqlite3");
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
    log,
  });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});

export function isDatabaseConfigured(): boolean {
  const url = cleanEnv(process.env.DATABASE_URL);
  if (!url) return false;
  if (url.startsWith("file:")) {
    return !isHostedRuntime();
  }
  if (url.startsWith("libsql:")) {
    return Boolean(cleanEnv(process.env.DATABASE_AUTH_TOKEN));
  }
  return false;
}
