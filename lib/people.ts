import { asc, desc, eq } from "drizzle-orm";

import type { OrcidWork, Researcher } from "@/db/schema";
import { orcidWorks, researchers } from "@/db/schema";
import { getDatabase } from "@/lib/db";

export function listPeople(): Researcher[] {
  return getDatabase()
    .select()
    .from(researchers)
    .orderBy(asc(researchers.name))
    .all();
}

export type PersonProfile = Researcher & { publications: OrcidWork[] };

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

  return { ...person, publications };
}
