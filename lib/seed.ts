import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";

import { researchers } from "@/db/schema";
import { DEFAULT_DATABASE_PATH } from "@/lib/db";
import {
  buildSearchDocument,
  type MockResearcher,
} from "@/lib/researcher-data";

export const MOCK_RESEARCHER_COUNT = 30;

export function loadMockResearchers(): MockResearcher[] {
  const dataPath = path.resolve(process.cwd(), "data", "researchers.json");
  return JSON.parse(fs.readFileSync(dataPath, "utf8")) as MockResearcher[];
}

export function seedDatabase(databasePath = DEFAULT_DATABASE_PATH): number {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");

  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "db/migrations") });

  const mockResearchers = loadMockResearchers();

  if (mockResearchers.length !== MOCK_RESEARCHER_COUNT) {
    sqlite.close();
    throw new Error(
      `Expected ${MOCK_RESEARCHER_COUNT} mock researchers, received ${mockResearchers.length}.`,
    );
  }

  const rows = mockResearchers.map((researcher) => ({
    ...researcher,
    searchDocument: buildSearchDocument(researcher),
    embedding: null,
  }));

  db.transaction((transaction) => {
    transaction.delete(researchers).run();
    transaction.insert(researchers).values(rows).run();
  });

  sqlite.close();
  return rows.length;
}
