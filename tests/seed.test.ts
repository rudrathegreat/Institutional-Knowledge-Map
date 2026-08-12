import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  orcidWorks,
  recommendationFeedback,
  researcherGroupMemberships,
  researchers,
  researchGroups,
} from "@/db/schema";
import { createDatabase } from "@/lib/db";
import {
  MOCK_ORCID_WORK_COUNT,
  MOCK_ORCID_WORKS_PER_RESEARCHER,
  MOCK_PRIMARY_MEMBERSHIP_COUNT,
  MOCK_RESEARCH_GROUP_COUNT,
  MOCK_RESEARCH_GROUP_MEMBERSHIP_COUNT,
  MOCK_RESEARCHER_COUNT,
  seedDatabase,
} from "@/lib/seed";

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
    const workRows = connection.db.select().from(orcidWorks).all();
    const groupRows = connection.db.select().from(researchGroups).all();
    const membershipRows = connection.db
      .select()
      .from(researcherGroupMemberships)
      .all();
    expect(rows).toHaveLength(MOCK_RESEARCHER_COUNT);
    expect(rows.every((row) => row.name && row.searchDocument)).toBe(true);
    expect(rows.every((row) => row.slug.length > 0)).toBe(true);
    expect(new Set(rows.map((row) => row.slug)).size).toBe(
      MOCK_RESEARCHER_COUNT,
    );
    expect(rows.every((row) => row.researchAreas.length > 0)).toBe(true);
    expect(rows.every((row) => row.embedding === null)).toBe(true);
    expect(rows.every((row) => row.biography.length >= 250)).toBe(true);
    expect(new Set(rows.map((row) => row.biography)).size).toBe(
      MOCK_RESEARCHER_COUNT,
    );
    expect(rows.every((row) => row.orcidIdStatus === "mock")).toBe(true);
    expect(new Set(rows.map((row) => row.orcidId)).size).toBe(
      MOCK_RESEARCHER_COUNT,
    );
    expect(
      rows.every((row) => /^0000-0000-DEMO-\d{4}$/.test(row.orcidId ?? "")),
    ).toBe(true);
    expect(workRows).toHaveLength(MOCK_ORCID_WORK_COUNT);
    expect(new Set(workRows.map((work) => work.id))).toHaveLength(
      MOCK_ORCID_WORK_COUNT,
    );
    expect(new Set(workRows.map((work) => work.title))).toHaveLength(
      MOCK_ORCID_WORK_COUNT,
    );
    expect(workRows.every((work) => work.dataSource === "mock")).toBe(true);
    expect(groupRows).toHaveLength(MOCK_RESEARCH_GROUP_COUNT);
    expect(new Set(groupRows.map(({ name }) => name))).toHaveLength(
      MOCK_RESEARCH_GROUP_COUNT,
    );
    expect(new Set(groupRows.map(({ slug }) => slug))).toHaveLength(
      MOCK_RESEARCH_GROUP_COUNT,
    );
    expect(
      groupRows.every(
        ({ slug, summary, researchAreas }) =>
          slug.length > 0 && summary.length > 0 && researchAreas.length > 0,
      ),
    ).toBe(true);
    expect(membershipRows).toHaveLength(MOCK_RESEARCH_GROUP_MEMBERSHIP_COUNT);
    expect(
      membershipRows.filter(({ isPrimary }) => isPrimary),
    ).toHaveLength(MOCK_PRIMARY_MEMBERSHIP_COUNT);
    expect(membershipRows.some(({ isPrimary }) => !isPrimary)).toBe(true);
    expect(
      new Set(membershipRows.map(({ researcherId }) => researcherId)),
    ).toHaveLength(MOCK_RESEARCHER_COUNT);
    expect(
      rows.every((row) => row.searchDocument.includes("Research groups:")),
    ).toBe(true);
    expect(
      rows.every(
        (row) =>
          workRows.filter((work) => work.researcherId === row.id).length ===
          MOCK_ORCID_WORKS_PER_RESEARCHER,
      ),
    ).toBe(true);

    connection.db
      .insert(researcherGroupMemberships)
      .values({
        researcherId: "researcher_001",
        researchGroupId: "group_transients",
        isPrimary: false,
      })
      .run();
    expect(
      connection.db
        .select()
        .from(researcherGroupMemberships)
        .all()
        .filter(({ researcherId }) => researcherId === "researcher_001"),
    ).toHaveLength(2);
    expect(() =>
      connection.db
        .update(researcherGroupMemberships)
        .set({ isPrimary: true })
        .where(
          and(
            eq(researcherGroupMemberships.researcherId, "researcher_001"),
            eq(
              researcherGroupMemberships.researchGroupId,
              "group_transients",
            ),
          ),
        )
        .run(),
    ).toThrow();
    connection.sqlite.close();
  });

  it("re-seeds the same IDs and records deterministically", () => {
    seedDatabase(TEST_DATABASE_PATH);
    const firstConnection = createDatabase(TEST_DATABASE_PATH);
    const firstRows = firstConnection.db
      .select()
      .from(researchers)
      .all()
      .map((row) => JSON.stringify(row));
    const firstWorks = firstConnection.db
      .select()
      .from(orcidWorks)
      .all()
      .map((row) => JSON.stringify(row));
    const firstGroups = firstConnection.db
      .select()
      .from(researchGroups)
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
    const secondWorks = secondConnection.db
      .select()
      .from(orcidWorks)
      .all()
      .map((row) => JSON.stringify(row));
    const secondGroups = secondConnection.db
      .select()
      .from(researchGroups)
      .all()
      .map((row) => JSON.stringify(row));
    secondConnection.sqlite.close();

    expect(secondRows).toEqual(firstRows);
    expect(secondWorks).toEqual(firstWorks);
    expect(secondGroups).toEqual(firstGroups);
  });

  it("preserves feedback for researcher IDs that remain in the seed", () => {
    seedDatabase(TEST_DATABASE_PATH);
    const firstConnection = createDatabase(TEST_DATABASE_PATH);
    firstConnection.db
      .insert(recommendationFeedback)
      .values({
        id: "10000000-0000-4000-8000-000000000001",
        searchId: "20000000-0000-4000-8000-000000000001",
        researcherId: "researcher_001",
        interpretedTerms: ["pulsars"],
        evidenceValues: ["pulsars"],
        evidenceCategories: ["researchArea"],
        retrievalPosition: 1,
        displayedPosition: 1,
        rankingMode: "deterministic",
        feedback: "helpful",
      })
      .run();
    firstConnection.sqlite.close();

    seedDatabase(TEST_DATABASE_PATH);
    const secondConnection = createDatabase(TEST_DATABASE_PATH);
    const feedbackRows = secondConnection.db
      .select()
      .from(recommendationFeedback)
      .all();
    secondConnection.sqlite.close();

    expect(feedbackRows).toHaveLength(1);
    expect(feedbackRows[0]).toMatchObject({
      researcherId: "researcher_001",
      feedback: "helpful",
    });
  });
});
