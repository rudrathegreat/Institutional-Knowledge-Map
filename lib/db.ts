import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";

import * as schema from "@/db/schema";

export const DEFAULT_DATABASE_PATH = path.resolve(
  process.cwd(),
  "data",
  "expertise.sqlite",
);

export function resolveDatabasePath(): string {
  return path.resolve(
    /* turbopackIgnore: true */
    process.env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH,
  );
}

export function createDatabase(databasePath = resolveDatabasePath()) {
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");

  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
  };
}

type DatabaseConnection = ReturnType<typeof createDatabase>;

const globalForDatabase = globalThis as typeof globalThis & {
  __expertiseDatabase?: DatabaseConnection;
};

export function getDatabase(): DatabaseConnection["db"] {
  if (!globalForDatabase.__expertiseDatabase) {
    globalForDatabase.__expertiseDatabase = createDatabase();
  }

  return globalForDatabase.__expertiseDatabase.db;
}

export function closeDatabase(): void {
  globalForDatabase.__expertiseDatabase?.sqlite.close();
  delete globalForDatabase.__expertiseDatabase;
}
