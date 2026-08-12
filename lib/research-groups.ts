import { asc, desc, eq, inArray, sql } from "drizzle-orm";

import type { Researcher, ResearchGroup } from "@/db/schema";
import {
  researcherGroupMemberships,
  researchers,
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
      slug: researchGroups.slug,
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

  for (const { researcherId, id, slug, name, isPrimary } of rows) {
    const memberships = groupsByResearcherId.get(researcherId) ?? [];
    memberships.push({ id, slug, name, isPrimary });
    groupsByResearcherId.set(researcherId, memberships);
  }

  return groupsByResearcherId;
}

export interface ResearchGroupMember {
  id: string;
  slug: string;
  name: string;
  title: string;
  role: string;
  isPrimary: boolean;
}

export type ResearchGroupProfile = ResearchGroup & {
  members: ResearchGroupMember[];
};

export function getResearchGroupMemberCounts(): Map<string, number> {
  const rows = getDatabase()
    .select({
      researchGroupId: researcherGroupMemberships.researchGroupId,
      memberCount: sql<number>`count(*)`,
    })
    .from(researcherGroupMemberships)
    .groupBy(researcherGroupMemberships.researchGroupId)
    .all();

  return new Map(
    rows.map(({ researchGroupId, memberCount }) => [
      researchGroupId,
      Number(memberCount),
    ]),
  );
}

export function getResearchGroupBySlug(
  slug: string,
): ResearchGroupProfile | undefined {
  const db = getDatabase();
  const group = db
    .select()
    .from(researchGroups)
    .where(eq(researchGroups.slug, slug))
    .get();

  if (!group) {
    return undefined;
  }

  const members = db
    .select({
      id: researchers.id,
      slug: researchers.slug,
      name: researchers.name,
      title: researchers.title,
      role: researchers.role,
      isPrimary: researcherGroupMemberships.isPrimary,
    })
    .from(researcherGroupMemberships)
    .innerJoin(
      researchers,
      eq(researcherGroupMemberships.researcherId, researchers.id),
    )
    .where(eq(researcherGroupMemberships.researchGroupId, group.id))
    .orderBy(asc(researchers.name))
    .all();

  return { ...group, members };
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
