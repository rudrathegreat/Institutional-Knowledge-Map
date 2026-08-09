import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POST } from "@/app/api/search/route";
import { closeDatabase } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

const TEST_DATABASE_PATH = path.resolve(
  process.cwd(),
  "data",
  "route-test.sqlite",
);

function requestWithBody(body: BodyInit) {
  return new Request("http://localhost/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/search", () => {
  beforeAll(() => {
    process.env.DATABASE_PATH = TEST_DATABASE_PATH;
    seedDatabase(TEST_DATABASE_PATH);
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
      name: "Maya Chen",
    });
  });
});
