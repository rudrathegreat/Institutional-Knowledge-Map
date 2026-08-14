import type { Researcher } from "@/db/schema";

export type SharedExpertiseCategory =
  | "research area"
  | "method"
  | "keyword"
  | "instrument"
  | "software";

export interface SharedEvidence {
  category: SharedExpertiseCategory;
  label: string;
}

export interface SharedExpertiseComparison {
  score: number;
  evidence: SharedEvidence[];
}

type ResearcherListField =
  | "researchAreas"
  | "methods"
  | "keywords"
  | "instruments"
  | "software";

interface EvidenceField {
  field: ResearcherListField;
  category: SharedExpertiseCategory;
  weight: number;
}

const EVIDENCE_FIELDS: EvidenceField[] = [
  { field: "researchAreas", category: "research area", weight: 5 },
  { field: "methods", category: "method", weight: 4 },
  { field: "keywords", category: "keyword", weight: 3 },
  { field: "instruments", category: "instrument", weight: 2 },
  { field: "software", category: "software", weight: 1 },
];

function normalizeValue(value: string): string {
  return value.trim().toLocaleLowerCase("en");
}

function evidenceKey(
  category: SharedExpertiseCategory,
  value: string,
): string {
  return `${category}:${normalizeValue(value)}`;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

export function findGenericExpertiseEvidence(
  researchers: Researcher[],
): Set<string> {
  const documentFrequency = new Map<string, number>();

  for (const researcher of researchers) {
    for (const { category, field } of EVIDENCE_FIELDS) {
      const uniqueValues = new Set(
        researcher[field].map((value) => evidenceKey(category, value)),
      );

      for (const key of uniqueValues) {
        documentFrequency.set(key, (documentFrequency.get(key) ?? 0) + 1);
      }
    }
  }

  const genericEvidence = new Set<string>();
  for (const [key, frequency] of documentFrequency) {
    if (frequency > researchers.length / 2) {
      genericEvidence.add(key);
    }
  }

  return genericEvidence;
}

export function compareSharedExpertise(
  left: Researcher,
  right: Researcher,
  genericEvidence: Set<string>,
): SharedExpertiseComparison {
  const evidence: SharedEvidence[] = [];
  let score = 0;

  for (const { category, field, weight } of EVIDENCE_FIELDS) {
    const rightValues = new Set(right[field].map(normalizeValue));
    const sharedValues = left[field]
      .filter((value) => rightValues.has(normalizeValue(value)))
      .filter((value) => !genericEvidence.has(evidenceKey(category, value)))
      .sort(compareText);

    for (const label of sharedValues) {
      evidence.push({ category, label });
      score += weight;
    }
  }

  return { score, evidence };
}
