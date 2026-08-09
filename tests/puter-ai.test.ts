import { afterEach, describe, expect, it, vi } from "vitest";

import type { SearchResultPayload } from "@/lib/api-types";
import {
  DEFAULT_PUTER_AI_MODEL,
  explainCandidates,
  getPuterAiModel,
  interpretQuery,
  mergeExplanationResponse,
  parseInterpretationResponse,
  PUTER_AI_TIMEOUT_MS,
} from "@/lib/puter-ai";

const vocabulary = [
  "fast radio bursts",
  "dedispersion",
  "ASKAP",
  "Bayesian inference",
];

const candidates: SearchResultPayload[] = [
  {
    id: "researcher_006",
    slug: "aisha-rahman",
    name: "Aisha Rahman",
    title: "Postdoctoral Researcher",
    role: "Fast Radio Burst Astronomer",
    researchAreas: ["fast radio bursts", "radio transients"],
    reason: "Deterministic Aisha reason.",
    evidence: {
      biography: "Aisha searches wide-field radio observations for fast radio bursts.",
      methods: ["dedispersion"],
      instruments: ["ASKAP"],
      software: ["PRESTO"],
      keywords: ["FRB"],
    },
  },
  {
    id: "researcher_003",
    slug: "priya-nair",
    name: "Priya Nair",
    title: "Lecturer",
    role: "Compact Object Researcher",
    researchAreas: ["compact objects"],
    reason: "Deterministic Priya reason.",
    evidence: {
      biography: "Priya models compact-object populations.",
      methods: ["Bayesian inference"],
      instruments: ["ASKAP"],
      software: ["Bilby"],
      keywords: ["uncertainty"],
    },
  },
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Puter query interpretation", () => {
  it("accepts fenced JSON, filters unknown terms, and deduplicates values", () => {
    const result = parseInterpretationResponse(
      {
        message: {
          content: `\`\`\`json
{"interpretation":"Finding people who study brief radio signals.","interpretedTopics":["Radio transients","radio transients"],"searchTerms":["fast radio bursts","FAST RADIO BURSTS","invented term","ASKAP"]}
\`\`\``,
        },
      },
      vocabulary,
    );

    expect(result).toEqual({
      interpretation: "Finding people who study brief radio signals.",
      interpretedTopics: ["Radio transients"],
      searchTerms: ["fast radio bursts", "ASKAP"],
    });
  });

  it.each([
    [{ message: { content: "not json" } }],
    [{ message: { content: "Here is JSON: {\"interpretation\":\"x\"}" } }],
    [
      {
        message: {
          content:
            '{"interpretation":"x","interpretedTopics":[],"searchTerms":[],"extra":true}',
        },
      },
    ],
  ])("rejects malformed or non-JSON model output", (response) => {
    expect(() => parseInterpretationResponse(response, vocabulary)).toThrow();
  });

  it("always calls Puter with the explicit non-OpenAI model and temperature zero", async () => {
    const client = {
      chat: vi.fn().mockResolvedValue({
        message: {
          content: JSON.stringify({
            interpretation: "Finding transient-radio expertise.",
            interpretedTopics: ["Radio transients"],
            searchTerms: ["fast radio bursts"],
          }),
        },
      }),
    };

    await expect(
      interpretQuery("a brief signal from far away", vocabulary, client),
    ).resolves.toMatchObject({ searchTerms: ["fast radio bursts"] });
    expect(client.chat).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        model: DEFAULT_PUTER_AI_MODEL,
        temperature: 0,
      }),
    );
  });

  it("rejects an OpenAI-prefixed configuration without calling Puter", async () => {
    vi.stubEnv("NEXT_PUBLIC_PUTER_AI_MODEL", "openai/gpt-5");
    const client = { chat: vi.fn() };

    expect(getPuterAiModel()).toBeNull();
    await expect(
      interpretQuery("find expertise", vocabulary, client),
    ).rejects.toThrow("not permitted");
    expect(client.chat).not.toHaveBeenCalled();
  });

  it("propagates authentication, quota, model, or timeout failures for fallback", async () => {
    const client = {
      chat: vi.fn().mockRejectedValue(new Error("quota exhausted")),
    };

    await expect(
      interpretQuery("find expertise", vocabulary, client),
    ).rejects.toThrow("quota exhausted");
  });

  it("times out an unresponsive Puter call so lexical fallback can continue", async () => {
    vi.useFakeTimers();
    const client = {
      chat: vi.fn().mockReturnValue(new Promise(() => undefined)),
    };
    const interpretation = interpretQuery("find expertise", vocabulary, client);
    const rejection = expect(interpretation).rejects.toThrow("timed out");

    await vi.advanceTimersByTimeAsync(PUTER_AI_TIMEOUT_MS);
    await rejection;
  });
});

describe("Puter explanation merging", () => {
  it("discards unknown and duplicate IDs while preserving server order", () => {
    const merged = mergeExplanationResponse(candidates, {
      message: {
        content: JSON.stringify({
          recommendations: [
            { researcherId: "researcher_003", reason: "AI reason for Priya." },
            { researcherId: "invented-person", reason: "Unsupported." },
            { researcherId: "researcher_003", reason: "Duplicate reason." },
            { researcherId: "researcher_006", reason: "AI reason for Aisha." },
          ],
        }),
      },
    });

    expect(merged.map((candidate) => candidate.id)).toEqual([
      "researcher_006",
      "researcher_003",
    ]);
    expect(merged.map((candidate) => candidate.reason)).toEqual([
      "AI reason for Aisha.",
      "AI reason for Priya.",
    ]);
  });

  it("retains deterministic reasons for candidates missing from valid output", () => {
    const merged = mergeExplanationResponse(candidates, {
      message: {
        content: JSON.stringify({
          recommendations: [
            { researcherId: "researcher_006", reason: "Grounded AI reason." },
          ],
        }),
      },
    });

    expect(merged[0]?.reason).toBe("Grounded AI reason.");
    expect(merged[1]?.reason).toBe("Deterministic Priya reason.");
  });

  it("sends only supplied candidates and grounded evidence for explanations", async () => {
    const client = {
      chat: vi.fn().mockResolvedValue({
        message: { content: '{"recommendations":[]}' },
      }),
    };

    await expect(
      explainCandidates("brief radio signal", candidates, client),
    ).resolves.toEqual(candidates);

    const messages = client.chat.mock.calls[0]?.[0] as Array<{
      role: string;
      content: string;
    }>;
    const userPayload = JSON.parse(messages[1]?.content ?? "{}") as {
      candidates: Array<{ researcherId: string }>;
    };

    expect(userPayload.candidates.map((candidate) => candidate.researcherId)).toEqual([
      "researcher_006",
      "researcher_003",
    ]);
    expect(client.chat.mock.calls[0]?.[1]).toMatchObject({
      model: DEFAULT_PUTER_AI_MODEL,
      temperature: 0,
    });
  });

  it("rejects missing reasons and malformed explanation output", () => {
    expect(() =>
      mergeExplanationResponse(candidates, {
        message: {
          content: '{"recommendations":[{"researcherId":"researcher_006"}]}',
        },
      }),
    ).toThrow();
  });
});
