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
      publications: [
        {
          id: "orcid_work_006_01",
          title:
            "Wide-field localisation strategies for repeating fast radio bursts",
          workType: "journal-article",
          publicationDate: "2026-01-29",
          dataSource: "mock",
        },
      ],
      matches: [
        {
          category: "researchArea",
          value: "fast radio bursts",
          origins: ["interpreted"],
          matchedTerms: ["fast radio bursts"],
        },
        {
          category: "publication",
          value:
            "Wide-field localisation strategies for repeating fast radio bursts",
          origins: ["query"],
          matchedTerms: ["brief radio signal"],
          publication: {
            id: "orcid_work_006_01",
            title:
              "Wide-field localisation strategies for repeating fast radio bursts",
            workType: "journal-article",
            publicationDate: "2026-01-29",
            dataSource: "mock",
          },
        },
      ],
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
      publications: [
        {
          id: "orcid_work_003_01",
          title:
            "Bayesian population constraints from incomplete radio-transient samples",
          workType: "journal-article",
          publicationDate: "2026-04-21",
          dataSource: "mock",
        },
      ],
      matches: [
        {
          category: "method",
          value: "Bayesian inference",
          origins: ["interpreted"],
          matchedTerms: ["Bayesian inference"],
        },
      ],
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
  it("uses valid model order while discarding unknown and duplicate IDs", () => {
    const merged = mergeExplanationResponse("radio transient expertise", candidates, {
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
      "researcher_003",
      "researcher_006",
    ]);
    expect(merged.map((candidate) => candidate.reason)).toEqual([
      "AI reason for Priya.",
      "AI reason for Aisha.",
    ]);
    expect(merged.map((candidate) => candidate.isSuggestedContact)).toEqual([
      true,
      undefined,
    ]);
  });

  it("appends omitted candidates in deterministic order with their original reasons", () => {
    const merged = mergeExplanationResponse("population modelling", candidates, {
      message: {
        content: JSON.stringify({
          recommendations: [
            { researcherId: "researcher_003", reason: "Grounded AI reason." },
          ],
        }),
      },
    });

    expect(merged.map((candidate) => candidate.id)).toEqual([
      "researcher_003",
      "researcher_006",
    ]);
    expect(merged[0]?.reason).toBe("Grounded AI reason.");
    expect(merged[1]?.reason).toBe("Deterministic Aisha reason.");
  });

  it("preserves exact-name precedence over model ordering", () => {
    const merged = mergeExplanationResponse("Aisha Rahman", candidates, {
      message: {
        content: JSON.stringify({
          recommendations: [
            { researcherId: "researcher_003", reason: "AI reason for Priya." },
            { researcherId: "researcher_006", reason: "AI reason for Aisha." },
          ],
        }),
      },
    });

    expect(merged.map((candidate) => candidate.id)).toEqual([
      "researcher_006",
      "researcher_003",
    ]);
    expect(merged[0]).toMatchObject({
      reason: "AI reason for Aisha.",
      isSuggestedContact: true,
    });
  });

  it("keeps deterministic ranking when no valid candidate is returned", () => {
    const merged = mergeExplanationResponse("radio transient", candidates, {
      message: {
        content: JSON.stringify({
          recommendations: [
            { researcherId: "invented-person", reason: "Unsupported." },
          ],
        }),
      },
    });

    expect(merged).toEqual(candidates);
  });

  it("sends only supplied candidates and traced matching evidence for explanations", async () => {
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
      candidates: Array<{
        researcherId: string;
        matchingEvidence: Array<{
          category: string;
          publication?: { id: string; dataSource: string };
        }>;
      }>;
    };

    expect(userPayload.candidates.map((candidate) => candidate.researcherId)).toEqual([
      "researcher_006",
      "researcher_003",
    ]);
    expect(userPayload.candidates[0]?.matchingEvidence).toEqual(
      candidates[0]?.evidence.matches,
    );
    expect(userPayload.candidates[0]).not.toHaveProperty("biography");
    expect(userPayload.candidates[0]).not.toHaveProperty("publications");
    expect(messages[0]?.content).toContain("listed demo publication");
    expect(messages[0]?.content).toContain("exact stored evidence");
    expect(client.chat.mock.calls[0]?.[1]).toMatchObject({
      model: DEFAULT_PUTER_AI_MODEL,
      temperature: 0,
    });
  });

  it("times out an unresponsive re-ranking call for deterministic fallback", async () => {
    vi.useFakeTimers();
    const client = {
      chat: vi.fn().mockReturnValue(new Promise(() => undefined)),
    };
    const explanation = explainCandidates("radio transient", candidates, client);
    const rejection = expect(explanation).rejects.toThrow("timed out");

    await vi.advanceTimersByTimeAsync(PUTER_AI_TIMEOUT_MS);
    await rejection;
  });

  it("rejects missing reasons and malformed explanation output", () => {
    expect(() =>
      mergeExplanationResponse("fast radio burst", candidates, {
        message: {
          content: '{"recommendations":[{"researcherId":"researcher_006"}]}',
        },
      }),
    ).toThrow();
  });
});
