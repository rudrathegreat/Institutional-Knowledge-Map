import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  POST,
  resetSearchRateLimitForTests,
} from "@/app/api/search/route";
import { closeDatabase } from "@/lib/db";
import { loadMockResearchers, seedDatabase } from "@/lib/seed";

const TEST_DATABASE_PATH = path.resolve(
  process.cwd(),
  "data",
  "route-test.sqlite",
);

function requestWithBody(body: BodyInit, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("POST /api/search", () => {
  beforeAll(() => {
    process.env.DATABASE_PATH = TEST_DATABASE_PATH;
    seedDatabase(TEST_DATABASE_PATH);
  });

  beforeEach(() => {
    resetSearchRateLimitForTests();
  });

  afterAll(() => {
    closeDatabase();
    delete process.env.DATABASE_PATH;
    for (const suffix of ["", "-shm", "-wal"]) {
      fs.rmSync(`${TEST_DATABASE_PATH}${suffix}`, { force: true });
    }
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(requestWithBody("{"));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("MALFORMED_JSON");
  });

  it.each([
    [JSON.stringify({}), "INVALID_QUERY"],
    [JSON.stringify({ query: 42 }), "INVALID_QUERY"],
    [JSON.stringify({ query: "   " }), "EMPTY_QUERY"],
    [JSON.stringify({ query: "x".repeat(2_001) }), "INVALID_QUERY"],
    [JSON.stringify({ query: "pulsars", interpretedTerms: [42] }), "INVALID_QUERY"],
    [
      JSON.stringify({
        query: "pulsars",
        interpretedTerms: Array.from({ length: 13 }, (_, index) => `term-${index}`),
      }),
      "INVALID_QUERY",
    ],
    [JSON.stringify({ query: "pulsars", unexpected: true }), "INVALID_QUERY"],
  ])("rejects an invalid query payload", async (body, errorCode) => {
    const response = await POST(requestWithBody(body));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe(errorCode);
  });

  it("returns a database-backed lexical result response", async () => {
    const response = await POST(
      requestWithBody(JSON.stringify({ query: "Maya Chen" })),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.interpretedTopics).toEqual([]);
    expect(payload.results[0]).toMatchObject({
      id: "researcher_001",
      slug: "maya-chen",
      name: "Maya Chen",
    });
    expect(payload.results[0].evidence).toMatchObject({
      biography: expect.stringContaining("long-baseline pulsar timing"),
      methods: expect.arrayContaining(["pulsar timing"]),
      instruments: expect.arrayContaining(["MeerKAT"]),
      software: expect.arrayContaining(["TEMPO2"]),
      keywords: expect.arrayContaining(["timing noise"]),
    });
  });

  it("uses validated interpreted terms for a vocabulary-mismatch query", async () => {
    const response = await POST(
      requestWithBody(
        JSON.stringify({
          query: "one-off mysterious beacon",
          interpretedTerms: ["fast radio bursts", "dedispersion"],
        }),
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results[0].id).toBe("researcher_006");
  });

  it("discards interpreted terms that are not in the database vocabulary", async () => {
    const response = await POST(
      requestWithBody(
        JSON.stringify({
          query: "one-off mysterious beacon",
          interpretedTerms: ["fabricated specialism"],
        }),
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results).toEqual([]);
  });

  it("never returns an identity outside the seeded SQLite directory", async () => {
    const response = await POST(
      requestWithBody(JSON.stringify({ query: "radio astronomy" })),
    );
    const payload = await response.json();
    const storedIds = new Set(loadMockResearchers().map((record) => record.id));

    expect(
      payload.results.every((result: { id: string }) => storedIds.has(result.id)),
    ).toBe(true);
  });

  it("rate limits the twenty-first search from one IP for sixty seconds", async () => {
    let response: Response | undefined;

    for (let requestNumber = 0; requestNumber < 21; requestNumber += 1) {
      response = await POST(
        requestWithBody(JSON.stringify({ query: "pulsars" }), {
          "x-forwarded-for": "203.0.113.20",
        }),
      );
    }

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toMatch(/^\d+$/);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: "RATE_LIMITED" },
    });
  });
});
