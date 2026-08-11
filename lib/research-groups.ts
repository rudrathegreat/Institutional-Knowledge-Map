import { asc, desc, eq, inArray } from "drizzle-orm";

import type { Researcher, ResearchGroup } from "@/db/schema";
import {
  researcherGroupMemberships,
  researchGroups,
} from "@/db/schema";
import type { ResearchGroupSummary } from "@/lib/api-types";
import { getDatabase } from "@/lib/db";

export type ResearcherWithGroups = Researcher & {
  researchGroups: ResearchGroupSummary[];
};

export function listResearchGroups(): ResearchGroup[] {
  return getDatabase()
    .select()
    .from(researchGroups)
    .orderBy(asc(researchGroups.name))
    .all();
}

export function getResearchGroupsByResearcherId(
  researcherIds?: string[],
): Map<string, ResearchGroupSummary[]> {
  if (researcherIds?.length === 0) {
    return new Map();
  }

  const db = getDatabase();
  const baseQuery = db
    .select({
      researcherId: researcherGroupMemberships.researcherId,
      id: researchGroups.id,
      name: researchGroups.name,
      isPrimary: researcherGroupMemberships.isPrimary,
    })
    .from(researcherGroupMemberships)
    .innerJoin(
      researchGroups,
      eq(researcherGroupMemberships.researchGroupId, researchGroups.id),
    )
    .orderBy(
      desc(researcherGroupMemberships.isPrimary),
      asc(researchGroups.name),
    );
  const rows = researcherIds
    ? baseQuery
        .where(inArray(researcherGroupMemberships.researcherId, researcherIds))
        .all()
    : baseQuery.all();
  const groupsByResearcherId = new Map<string, ResearchGroupSummary[]>();

  for (const { researcherId, id, name, isPrimary } of rows) {
    const memberships = groupsByResearcherId.get(researcherId) ?? [];
    memberships.push({ id, name, isPrimary });
    groupsByResearcherId.set(researcherId, memberships);
  }

  return groupsByResearcherId;
}

export function attachResearchGroups(
  records: Researcher[],
): ResearcherWithGroups[] {
  const groupsByResearcherId = getResearchGroupsByResearcherId(
    records.map(({ id }) => id),
  );

  return records.map((researcher) => ({
    ...researcher,
    researchGroups: groupsByResearcherId.get(researcher.id) ?? [],
  }));
}
