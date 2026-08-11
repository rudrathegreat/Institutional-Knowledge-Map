import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { recommendationFeedback } from "@/db/schema";
import type {
  RecommendationFeedbackValue,
  RecommendationRankingMode,
  SearchResultPayload,
} from "@/lib/api-types";
import { getDatabase } from "@/lib/db";
import type { SearchResult } from "@/lib/search";

function uniqueStoredEvidence(
  result: SearchResult,
): { categories: string[]; values: string[] } {
  const categories = new Set<string>();
  const values = new Map<string, string>();

  for (const match of result.evidence.matches) {
    const value = match.value.trim();

    categories.add(match.category);
    if (value) {
      const normalizedValue = value.toLocaleLowerCase();
      if (!values.has(normalizedValue)) {
        values.set(normalizedValue, value);
      }
    }
  }

  return {
    categories: [...categories],
    values: [...values.values()],
  };
}

export function createRecommendationContexts(
  results: SearchResult[],
  validInterpretedTerms: string[],
): SearchResultPayload[] {
  if (results.length === 0) {
    return [];
  }

  const db = getDatabase();
  const searchId = randomUUID();
  const contexts = results.map((result, index) => {
    const recommendationId = randomUUID();
    const storedEvidence = uniqueStoredEvidence(result);

    return {
      result: { ...result, recommendationId },
      row: {
        id: recommendationId,
        searchId,
        researcherId: result.id,
        interpretedTerms: validInterpretedTerms,
        evidenceValues: storedEvidence.values,
        evidenceCategories: storedEvidence.categories,
        retrievalPosition: index + 1,
      },
    };
  });

  db.insert(recommendationFeedback)
    .values(contexts.map((context) => context.row))
    .run();

  return contexts.map((context) => context.result);
}

export function saveRecommendationFeedback(
  recommendationId: string,
  feedback: RecommendationFeedbackValue,
  displayedPosition: number,
  rankingMode: RecommendationRankingMode,
): boolean {
  const result = getDatabase()
    .update(recommendationFeedback)
    .set({
      feedback,
      displayedPosition,
      rankingMode,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(recommendationFeedback.id, recommendationId))
    .run();

  return result.changes > 0;
}
