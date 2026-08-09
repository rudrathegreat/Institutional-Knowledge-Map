import { asc, eq } from "drizzle-orm";

import type { Researcher } from "@/db/schema";
import { researchers } from "@/db/schema";
import { getDatabase } from "@/lib/db";

export function listPeople(): Researcher[] {
  return getDatabase()
    .select()
    .from(researchers)
    .orderBy(asc(researchers.name))
    .all();
}

export function getPersonBySlug(slug: string): Researcher | undefined {
  return getDatabase()
    .select()
    .from(researchers)
    .where(eq(researchers.slug, slug))
    .get();
}
