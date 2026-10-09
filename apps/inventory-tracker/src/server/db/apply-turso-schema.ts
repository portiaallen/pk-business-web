import { assertResourceEnvironment } from "@/server/security-environment";
import { isDatabaseConfigured } from "@/server/db/client";

function createLibsqlClient() {
  assertResourceEnvironment("DATABASE");
  const url = process.env.DATABASE_URL?.trim();
  const authToken = process.env.DATABASE_AUTH_TOKEN?.trim();

  if (!url?.startsWith("libsql:") || !authToken) {
    throw new Error("Turso is not configured.");
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@libsql/client") as typeof import("@libsql/client");
  return createClient({ url, authToken });
}

async function tableExists(
  client: ReturnType<typeof createLibsqlClient>,
  tableName: string
): Promise<boolean> {
  const result = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
    args: [tableName],
  });
  return result.rows.length > 0;
}

export type TursoSchemaStatus = "applied" | "migrated" | "exists" | "not_turso";

let tursoReadyPromise: Promise<TursoSchemaStatus> | null = null;

export async function ensureTursoSchema(): Promise<TursoSchemaStatus> {
  if (!isDatabaseConfigured()) {
    throw new Error("Database is not configured.");
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (!databaseUrl.startsWith("libsql:")) {
    return "not_turso";
  }

  const client = createLibsqlClient();
  const hasInventoryTable = await tableExists(client, "InventoryProduct");

  if (!hasInventoryTable) {
    throw new Error("Inventory schema missing; approved offline provisioning required");
  }

  return "exists";
}

/** Ensures Turso inventory tables are applied once per serverless instance. */
export async function ensureTursoReady(): Promise<TursoSchemaStatus> {
  if (!isDatabaseConfigured()) {
    return "not_turso";
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (!databaseUrl.startsWith("libsql:")) {
    return "not_turso";
  }

  if (!tursoReadyPromise) {
    tursoReadyPromise = ensureTursoSchema().catch((error) => {
      tursoReadyPromise = null;
      throw error;
    });
  }

  return tursoReadyPromise;
}
