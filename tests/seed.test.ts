import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { researchers } from "@/db/schema";
import { createDatabase } from "@/lib/db";
import { MOCK_RESEARCHER_COUNT, seedDatabase } from "@/lib/seed";

const TEST_DATABASE_PATH = path.resolve(
  process.cwd(),
  "data",
  "seed-test.sqlite",
);

function removeTestDatabase() {
  for (const suffix of ["", "-shm", "-wal"]) {
    fs.rmSync(`${TEST_DATABASE_PATH}${suffix}`, { force: true });
  }
}

describe("database seeding", () => {
  beforeAll(removeTestDatabase);
  afterAll(removeTestDatabase);

  it("creates exactly 30 complete fictional researcher records", () => {
    expect(seedDatabase(TEST_DATABASE_PATH)).toBe(MOCK_RESEARCHER_COUNT);

    const connection = createDatabase(TEST_DATABASE_PATH);
    const rows = connection.db.select().from(researchers).all();
    connection.sqlite.close();

    expect(rows).toHaveLength(MOCK_RESEARCHER_COUNT);
    expect(rows.every((row) => row.name && row.searchDocument)).toBe(true);
    expect(rows.every((row) => row.researchAreas.length > 0)).toBe(true);
    expect(rows.every((row) => row.embedding === null)).toBe(true);
  });

  it("re-seeds the same IDs and records deterministically", () => {
    seedDatabase(TEST_DATABASE_PATH);
    const firstConnection = createDatabase(TEST_DATABASE_PATH);
    const firstRows = firstConnection.db
      .select()
      .from(researchers)
      .all()
      .map((row) => JSON.stringify(row));
    firstConnection.sqlite.close();

    seedDatabase(TEST_DATABASE_PATH);
    const secondConnection = createDatabase(TEST_DATABASE_PATH);
    const secondRows = secondConnection.db
      .select()
      .from(researchers)
      .all()
      .map((row) => JSON.stringify(row));
    secondConnection.sqlite.close();

    expect(secondRows).toEqual(firstRows);
  });
});
