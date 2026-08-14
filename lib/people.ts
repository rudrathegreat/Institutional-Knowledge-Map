import { asc, desc, eq } from "drizzle-orm";

import type { OrcidWork } from "@/db/schema";
import { orcidWorks, researchers } from "@/db/schema";
import { getDatabase } from "@/lib/db";
import {
  deriveRelatedPeople,
  type RelatedPeople,
} from "@/lib/related-people";
import {
  attachResearchGroups,
  type ResearcherWithGroups,
} from "@/lib/research-groups";

export function listPeople(): ResearcherWithGroups[] {
  const people = getDatabase()
    .select()
    .from(researchers)
    .orderBy(asc(researchers.name))
    .all();

  return attachResearchGroups(people);
}

export type PersonProfile = ResearcherWithGroups & { publications: OrcidWork[] };

export function getPersonBySlug(slug: string): PersonProfile | undefined {
  const db = getDatabase();
  const person = db
    .select()
    .from(researchers)
    .where(eq(researchers.slug, slug))
    .get();

  if (!person) {
    return undefined;
  }

  const publications = db
    .select()
    .from(orcidWorks)
    .where(eq(orcidWorks.researcherId, person.id))
    .orderBy(desc(orcidWorks.publicationDate), asc(orcidWorks.title))
    .all();

  const [personWithGroups] = attachResearchGroups([person]);

  return { ...personWithGroups, publications };
}

export function getRelatedPeopleByPersonId(
  researcherId: string,
): RelatedPeople {
  return deriveRelatedPeople(researcherId, listPeople());
}
