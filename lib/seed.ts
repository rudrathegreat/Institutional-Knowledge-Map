import Database from "better-sqlite3";
import { notInArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";

import {
  orcidWorks,
  researcherGroupMemberships,
  researchers,
  researchGroups,
  type NewResearchGroup,
} from "@/db/schema";
import { DEFAULT_DATABASE_PATH } from "@/lib/db";
import {
  buildSearchDocument,
  type MockResearcher,
} from "@/lib/researcher-data";

export const MOCK_RESEARCHER_COUNT = 30;
export const MOCK_RESEARCH_GROUP_COUNT = 6;
export const MOCK_RESEARCH_GROUP_MEMBERSHIP_COUNT = 39;
export const MOCK_PRIMARY_MEMBERSHIP_COUNT = MOCK_RESEARCHER_COUNT;
export const MOCK_ORCID_WORKS_PER_RESEARCHER = 3;
export const MOCK_ORCID_WORK_COUNT =
  MOCK_RESEARCHER_COUNT * MOCK_ORCID_WORKS_PER_RESEARCHER;

export interface MockOrcidWork {
  id: string;
  title: string;
  workType: string;
  publicationDate: string;
}

export interface MockOrcidRecord {
  researcherId: string;
  orcidId: string;
  orcidIdStatus: "mock";
  works: MockOrcidWork[];
}

export type MockResearchGroup = NewResearchGroup;

export interface MockResearchGroupMembership {
  researcherId: string;
  researchGroupId: string;
  isPrimary: boolean;
}

export function loadMockResearchers(): MockResearcher[] {
  const dataPath = path.resolve(process.cwd(), "data", "researchers.json");
  return JSON.parse(fs.readFileSync(dataPath, "utf8")) as MockResearcher[];
}

export function loadMockOrcidRecords(): MockOrcidRecord[] {
  const dataPath = path.resolve(process.cwd(), "data", "orcid-records.json");
  return JSON.parse(fs.readFileSync(dataPath, "utf8")) as MockOrcidRecord[];
}

export function loadMockResearchGroups(): MockResearchGroup[] {
  const dataPath = path.resolve(process.cwd(), "data", "research-groups.json");
  return JSON.parse(fs.readFileSync(dataPath, "utf8")) as MockResearchGroup[];
}

export function loadMockResearchGroupMemberships(): MockResearchGroupMembership[] {
  const dataPath = path.resolve(
    process.cwd(),
    "data",
    "research-group-memberships.json",
  );
  return JSON.parse(
    fs.readFileSync(dataPath, "utf8"),
  ) as MockResearchGroupMembership[];
}

function validateMockResearchGroups(
  mockResearchers: MockResearcher[],
  mockResearchGroups: MockResearchGroup[],
  memberships: MockResearchGroupMembership[],
): void {
  const researcherIds = new Set(mockResearchers.map(({ id }) => id));
  const groupIds = new Set(mockResearchGroups.map(({ id }) => id));
  const groupSlugs = mockResearchGroups.map(({ slug }) => slug.trim());
  const groupNames = mockResearchGroups.map(({ name }) => name.trim());

  if (
    mockResearchGroups.length !== MOCK_RESEARCH_GROUP_COUNT ||
    groupIds.size !== MOCK_RESEARCH_GROUP_COUNT ||
    groupSlugs.some((slug) => !slug) ||
    new Set(groupSlugs).size !== MOCK_RESEARCH_GROUP_COUNT ||
    groupNames.some((name) => !name) ||
    new Set(groupNames).size !== MOCK_RESEARCH_GROUP_COUNT ||
    mockResearchGroups.some(
      ({ summary, researchAreas }) =>
        !summary.trim() ||
        researchAreas.length === 0 ||
        researchAreas.some((area) => !area.trim()),
    )
  ) {
    throw new Error(
      `Mock research groups must contain ${MOCK_RESEARCH_GROUP_COUNT} complete records with unique IDs, slugs, and names.`,
    );
  }

  if (
    memberships.length !== MOCK_RESEARCH_GROUP_MEMBERSHIP_COUNT ||
    memberships.some(
      ({ researcherId, researchGroupId }) =>
        !researcherIds.has(researcherId) || !groupIds.has(researchGroupId),
    ) ||
    new Set(
      memberships.map(
        ({ researcherId, researchGroupId }) =>
          `${researcherId}:${researchGroupId}`,
      ),
    ).size !== memberships.length
  ) {
    throw new Error(
      `Research-group memberships must contain ${MOCK_RESEARCH_GROUP_MEMBERSHIP_COUNT} valid, unique researcher/group pairs.`,
    );
  }

  const primaryMemberships = memberships.filter(({ isPrimary }) => isPrimary);
  if (
    primaryMemberships.length !== MOCK_PRIMARY_MEMBERSHIP_COUNT ||
    new Set(primaryMemberships.map(({ researcherId }) => researcherId)).size !==
      MOCK_RESEARCHER_COUNT
  ) {
    throw new Error(
      "Every mock researcher must have exactly one primary research group.",
    );
  }
}

function validateMockOrcidRecords(
  mockResearchers: MockResearcher[],
  mockOrcidRecords: MockOrcidRecord[],
): void {
  if (mockOrcidRecords.length !== MOCK_RESEARCHER_COUNT) {
    throw new Error(
      `Expected ${MOCK_RESEARCHER_COUNT} mock ORCID records, received ${mockOrcidRecords.length}.`,
    );
  }

  const researcherIds = new Set(mockResearchers.map(({ id }) => id));
  const linkedResearcherIds = mockOrcidRecords.map(({ researcherId }) =>
    researcherId.trim(),
  );
  const orcidIds = mockOrcidRecords.map(({ orcidId }) => orcidId.trim());
  const works = mockOrcidRecords.flatMap(({ researcherId, works: recordWorks }) =>
    recordWorks.map((work) => ({ ...work, researcherId })),
  );

  if (
    linkedResearcherIds.some((id) => !researcherIds.has(id)) ||
    new Set(linkedResearcherIds).size !== MOCK_RESEARCHER_COUNT ||
    [...researcherIds].some((id) => !linkedResearcherIds.includes(id))
  ) {
    throw new Error("Mock ORCID records must cover every researcher exactly once.");
  }

  if (
    orcidIds.some((id) => !/^0000-0000-DEMO-\d{4}$/.test(id)) ||
    new Set(orcidIds).size !== MOCK_RESEARCHER_COUNT ||
    mockOrcidRecords.some(({ orcidIdStatus }) => orcidIdStatus !== "mock")
  ) {
    throw new Error("Mock ORCID iDs must be unique, clearly fictional demo IDs.");
  }

  if (
    mockOrcidRecords.some(
      ({ works: recordWorks }) =>
        recordWorks.length !== MOCK_ORCID_WORKS_PER_RESEARCHER,
    ) ||
    works.length !== MOCK_ORCID_WORK_COUNT ||
    new Set(works.map(({ id }) => id)).size !== MOCK_ORCID_WORK_COUNT ||
    new Set(works.map(({ title }) => title.trim())).size !== MOCK_ORCID_WORK_COUNT
  ) {
    throw new Error(
      `Mock ORCID records must contain ${MOCK_ORCID_WORKS_PER_RESEARCHER} unique works per researcher.`,
    );
  }

  if (
    works.some(
      ({ id, title, workType, publicationDate }) =>
        !id.trim() ||
        !title.trim() ||
        !workType.trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(publicationDate) ||
        publicationDate < "2024-01-01" ||
        publicationDate > "2026-07-31",
    )
  ) {
    throw new Error(
      "Mock ORCID works require complete fields and publication dates from 2024 through July 2026.",
    );
  }
}

export function seedDatabase(databasePath = DEFAULT_DATABASE_PATH): number {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");

  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "db/migrations") });

  const mockResearchers = loadMockResearchers();
  const mockOrcidRecords = loadMockOrcidRecords();
  const mockResearchGroups = loadMockResearchGroups();
  const mockResearchGroupMemberships = loadMockResearchGroupMemberships();

  if (mockResearchers.length !== MOCK_RESEARCHER_COUNT) {
    sqlite.close();
    throw new Error(
      `Expected ${MOCK_RESEARCHER_COUNT} mock researchers, received ${mockResearchers.length}.`,
    );
  }

  const slugs = mockResearchers.map((researcher) => researcher.slug);

  if (
    slugs.some((slug) => !slug.trim()) ||
    new Set(slugs).size !== mockResearchers.length
  ) {
    sqlite.close();
    throw new Error("Researcher slugs must be non-empty and unique.");
  }

  validateMockOrcidRecords(mockResearchers, mockOrcidRecords);
  validateMockResearchGroups(
    mockResearchers,
    mockResearchGroups,
    mockResearchGroupMemberships,
  );

  const orcidRecordByResearcherId = new Map(
    mockOrcidRecords.map((record) => [record.researcherId, record]),
  );

  const groupNameById = new Map(
    mockResearchGroups.map(({ id, name }) => [id, name]),
  );
  const groupNamesByResearcherId = new Map<string, string[]>();
  for (const membership of mockResearchGroupMemberships) {
    const names = groupNamesByResearcherId.get(membership.researcherId) ?? [];
    const groupName = groupNameById.get(membership.researchGroupId);
    if (groupName) {
      names.push(groupName);
      groupNamesByResearcherId.set(membership.researcherId, names);
    }
  }

  const rows = mockResearchers.map((researcher) => {
    const researchGroupNames = (
      groupNamesByResearcherId.get(researcher.id) ?? []
    ).sort((left, right) => left.localeCompare(right, "en"));

    return {
      ...researcher,
      orcidId: orcidRecordByResearcherId.get(researcher.id)?.orcidId ?? null,
      orcidIdStatus:
        orcidRecordByResearcherId.get(researcher.id)?.orcidIdStatus ?? null,
      searchDocument: buildSearchDocument(researcher, researchGroupNames),
      embedding: null,
    };
  });

  const workRows = mockOrcidRecords.flatMap((record) =>
    record.works.map((work) => ({
      ...work,
      researcherId: record.researcherId,
      externalIdType: null,
      externalIdValue: null,
      externalUrl: null,
      dataSource: "mock" as const,
    })),
  );

  db.transaction((transaction) => {
    transaction.delete(orcidWorks).run();
    transaction.delete(researcherGroupMemberships).run();

    for (const row of rows) {
      transaction
        .insert(researchers)
        .values(row)
        .onConflictDoUpdate({
          target: researchers.id,
          set: row,
        })
        .run();
    }

    transaction
      .delete(researchers)
      .where(notInArray(researchers.id, rows.map(({ id }) => id)))
      .run();

    for (const group of mockResearchGroups) {
      transaction
        .insert(researchGroups)
        .values(group)
        .onConflictDoUpdate({
          target: researchGroups.id,
          set: group,
        })
        .run();
    }

    transaction
      .delete(researchGroups)
      .where(notInArray(researchGroups.id, mockResearchGroups.map(({ id }) => id)))
      .run();
    transaction
      .insert(researcherGroupMemberships)
      .values(mockResearchGroupMemberships)
      .run();
    transaction.insert(orcidWorks).values(workRows).run();
  });

  sqlite.close();
  return rows.length;
}
