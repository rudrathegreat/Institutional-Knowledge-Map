import type { NewResearcher } from "@/db/schema";

export type MockResearcher = Omit<
  NewResearcher,
  "searchDocument" | "embedding"
>;

export function buildSearchDocument(
  researcher: MockResearcher,
  researchGroupNames: string[] = [],
): string {
  return [
    `${researcher.name}.`,
    `${researcher.title}.`,
    `Role: ${researcher.role}.`,
    `Research areas: ${researcher.researchAreas.join(", ")}.`,
    `Methods: ${researcher.methods.join(", ")}.`,
    `Instruments: ${researcher.instruments.join(", ")}.`,
    `Software: ${researcher.software.join(", ")}.`,
    `Keywords: ${researcher.keywords.join(", ")}.`,
    `Research groups: ${researchGroupNames.join(", ")}.`,
    `Biography: ${researcher.biography}`,
  ].join(" ");
}
