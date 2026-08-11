import fs from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  POST as submitFeedback,
  resetRecommendationFeedbackRateLimitForTests,
} from "@/app/api/recommendation-feedback/route";
import {
  POST as search,
  resetSearchRateLimitForTests,
} from "@/app/api/search/route";
import { recommendationFeedback } from "@/db/schema";
import { closeDatabase, createDatabase } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

const TEST_DATABASE_PATH = path.resolve(
  process.cwd(),
  "data",
  "recommendation-feedback-route-test.sqlite",
);

function requestWithBody(
  url: string,
  body: BodyInit,
  headers: Record<string, string> = {},
) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

async function createRecommendation() {
  const response = await search(
    requestWithBody(
      "http://localhost/api/search",
      JSON.stringify({
        query: "one-off mysterious beacon",
        interpretedTerms: ["fast radio bursts", "fabricated specialism"],
      }),
    ),
  );
  const payload = await response.json();

  return payload.results[0] as {
    recommendationId: string;
    id: string;
  };
}

describe("POST /api/recommendation-feedback", () => {
  beforeAll(() => {
    process.env.DATABASE_PATH = TEST_DATABASE_PATH;
    seedDatabase(TEST_DATABASE_PATH);
  });

  beforeEach(() => {
    resetSearchRateLimitForTests();
    resetRecommendationFeedbackRateLimitForTests();
  });

  afterAll(() => {
    closeDatabase();
    delete process.env.DATABASE_PATH;
    for (const suffix of ["", "-shm", "-wal"]) {
      fs.rmSync(`${TEST_DATABASE_PATH}${suffix}`, { force: true });
    }
  });

  it("stores controlled context without the raw query and updates one answer", async () => {
    const recommendation = await createRecommendation();
    const feedbackRequest = (feedback: "helpful" | "not_relevant") =>
      requestWithBody(
        "http://localhost/api/recommendation-feedback",
        JSON.stringify({
          recommendationId: recommendation.recommendationId,
          feedback,
          displayedPosition: 2,
          rankingMode: "ai",
        }),
      );

    const helpfulResponse = await submitFeedback(feedbackRequest("helpful"));
    expect(helpfulResponse.status).toBe(200);
    await expect(helpfulResponse.json()).resolves.toEqual({
      feedback: "helpful",
    });

    const changedResponse = await submitFeedback(
      feedbackRequest("not_relevant"),
    );
    expect(changedResponse.status).toBe(200);

    const connection = createDatabase(TEST_DATABASE_PATH);
    const rows = connection.db
      .select()
      .from(recommendationFeedback)
      .where(eq(recommendationFeedback.id, recommendation.recommendationId))
      .all();
    connection.sqlite.close();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      researcherId: recommendation.id,
      interpretedTerms: ["fast radio bursts"],
      feedback: "not_relevant",
      displayedPosition: 2,
      rankingMode: "ai",
    });
    expect(rows[0].evidenceValues.length).toBeGreaterThan(0);
    expect(rows[0].evidenceCategories.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows[0])).not.toContain("one-off mysterious beacon");
    expect(rows[0]).not.toHaveProperty("query");
    expect(rows[0]).not.toHaveProperty("ip");
  });

  it.each([
    ["{", "MALFORMED_JSON"],
    [
      JSON.stringify({
        recommendationId: "not-a-uuid",
        feedback: "helpful",
        displayedPosition: 1,
        rankingMode: "deterministic",
      }),
      "INVALID_FEEDBACK",
    ],
    [
      JSON.stringify({
        recommendationId: "10000000-0000-4000-8000-000000000099",
        feedback: "rating-five-stars",
        displayedPosition: 1,
        rankingMode: "deterministic",
      }),
      "INVALID_FEEDBACK",
    ],
  ])("rejects malformed or invalid feedback", async (body, errorCode) => {
    const response = await submitFeedback(
      requestWithBody("http://localhost/api/recommendation-feedback", body),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe(errorCode);
  });

  it("returns not found for an unknown recommendation context", async () => {
    const response = await submitFeedback(
      requestWithBody(
        "http://localhost/api/recommendation-feedback",
        JSON.stringify({
          recommendationId: "10000000-0000-4000-8000-000000000099",
          feedback: "helpful",
          displayedPosition: 1,
          rankingMode: "deterministic",
        }),
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe("RECOMMENDATION_NOT_FOUND");
  });

  it("rate limits the sixty-first feedback request from one IP", async () => {
    let response: Response | undefined;

    for (let requestNumber = 0; requestNumber < 61; requestNumber += 1) {
      response = await submitFeedback(
        requestWithBody(
          "http://localhost/api/recommendation-feedback",
          JSON.stringify({
            recommendationId: "10000000-0000-4000-8000-000000000099",
            feedback: "helpful",
            displayedPosition: 1,
            rankingMode: "deterministic",
          }),
          { "x-forwarded-for": "203.0.113.60" },
        ),
      );
    }

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toMatch(/^\d+$/);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: "RATE_LIMITED" },
    });
  });
});
