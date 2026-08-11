import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SearchExperience } from "@/components/SearchExperience";

const puterAiMocks = vi.hoisted(() => ({
  interpretQuery: vi.fn(),
  explainCandidates: vi.fn(),
  getAuthenticatedPuterChatClient: vi.fn(),
  preloadPuterAi: vi.fn(),
}));

vi.mock("@/lib/puter-ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/puter-ai")>()),
  ...puterAiMocks,
}));

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  puterAiMocks.getAuthenticatedPuterChatClient.mockResolvedValue({
    chat: vi.fn(),
  });
  puterAiMocks.interpretQuery.mockRejectedValue(new Error("sign-in cancelled"));
  puterAiMocks.explainCandidates.mockImplementation(
    async (_query, candidates) => candidates,
  );
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SearchExperience", () => {
  it("renders the focused single-search interface", () => {
    render(<SearchExperience />);

    expect(
      screen.getByRole("heading", { name: "Who should I talk to?" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Search for expertise")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeEnabled();
  });

  it("announces authorization separately from model interpretation", async () => {
    const user = userEvent.setup();
    let finishAuthorization: ((client: { chat: ReturnType<typeof vi.fn> }) => void) | undefined;
    puterAiMocks.getAuthenticatedPuterChatClient.mockReturnValue(
      new Promise((resolve) => {
        finishAuthorization = resolve;
      }),
    );
    puterAiMocks.interpretQuery.mockResolvedValue({
      kind: "ready",
      interpretation: "Finding pulsar expertise.",
      interpretedTopics: ["Pulsars"],
      searchTerms: ["pulsars"],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ interpretedTopics: [], results: [] }),
      }),
    );

    render(<SearchExperience expertiseVocabulary={["pulsars"]} />);
    await user.type(
      screen.getByLabelText("Search for expertise"),
      "pulsar work{enter}",
    );

    expect(
      await screen.findByText("Connecting to Puter for AI assistance…"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();

    await act(async () => {
      finishAuthorization?.({ chat: vi.fn() });
    });

    expect(
      await screen.findByRole("heading", { name: "No strong matches found." }),
    ).toBeInTheDocument();
  });

  it("retries the same search with AI after a recoverable failure", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ interpretedTopics: [], results: [] }),
      }),
    );

    render(<SearchExperience expertiseVocabulary={["pulsars"]} />);
    await user.type(
      screen.getByLabelText("Search for expertise"),
      "pulsar work{enter}",
    );
    const retryButton = await screen.findByRole("button", {
      name: "Retry with AI",
    });

    puterAiMocks.interpretQuery.mockResolvedValue({
      kind: "ready",
      interpretation: "Finding pulsar specialists.",
      interpretedTopics: ["Pulsars"],
      searchTerms: ["pulsars"],
    });
    await user.click(retryButton);

    expect(
      await screen.findByText("Finding pulsar specialists."),
    ).toBeInTheDocument();
    expect(puterAiMocks.interpretQuery).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("shows authentication transport guidance and logs only safe diagnostics", async () => {
    const user = userEvent.setup();
    const sensitiveCause = {
      status: 0,
      code: "network_error",
      requestBody: "private expertise query",
      authorization: "Bearer private-token",
    };
    puterAiMocks.getAuthenticatedPuterChatClient.mockRejectedValue(sensitiveCause);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ interpretedTopics: [], results: [] }),
      }),
    );

    render(<SearchExperience expertiseVocabulary={["pulsars"]} />);
    await user.type(
      screen.getByLabelText("Search for expertise"),
      "private expertise query{enter}",
    );

    expect(
      await screen.findByText(/Puter sign-in could not connect/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry with AI" }),
    ).toBeInTheDocument();

    const warning = vi.mocked(console.warn).mock.calls.at(-1);
    expect(warning?.[0]).toContain("authentication failed (network_error)");
    expect(warning?.[1]).toMatchObject({
      stage: "authentication",
      transport: "authentication",
      status: 0,
      sdkCode: "network_error",
    });
    expect(JSON.stringify(warning)).not.toContain("private expertise query");
    expect(JSON.stringify(warning)).not.toContain("private-token");
  });

  it("ignores an AI response from a superseded search", async () => {
    const user = userEvent.setup();
    let finishFirstInterpretation:
      | ((value: {
          kind: "ready";
          interpretation: string;
          interpretedTopics: string[];
          searchTerms: string[];
        }) => void)
      | undefined;
    puterAiMocks.interpretQuery
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishFirstInterpretation = resolve;
        }),
      )
      .mockResolvedValueOnce({
        kind: "ready",
        interpretation: "Second interpretation.",
        interpretedTopics: ["ASKAP"],
        searchTerms: ["ASKAP"],
      });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ interpretedTopics: [], results: [] }),
      }),
    );

    render(<SearchExperience expertiseVocabulary={["pulsars", "ASKAP"]} />);
    const input = screen.getByLabelText("Search for expertise");
    await user.type(input, "first query{enter}");
    await screen.findByText("Interpreting your need…");

    await user.clear(input);
    await user.type(input, "second query");
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(await screen.findByText("Second interpretation.")).toBeInTheDocument();
    await act(async () => {
      finishFirstInterpretation?.({
        kind: "ready",
        interpretation: "Stale first interpretation.",
        interpretedTopics: ["Pulsars"],
        searchTerms: ["pulsars"],
      });
    });

    expect(screen.queryByText("Stale first interpretation.")).not.toBeInTheDocument();
    expect(screen.getByText("Second interpretation.")).toBeInTheDocument();
  });

  it("rejects an empty query through pointer submission", async () => {
    const user = userEvent.setup();
    render(<SearchExperience />);

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a name, topic, method, instrument, software term, or question.",
    );
  });

  it("submits with Enter and renders grounded researcher results", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          interpretedTopics: [],
          results: [
            {
              recommendationId: "10000000-0000-4000-8000-000000000102",
              id: "researcher_002",
              slug: "daniel-brooks",
              name: "Daniel Brooks",
              title: "Research Fellow",
              role: "Radio Astronomer",
              researchAreas: ["pulsars", "radio astronomy"],
              reason:
                "Their stored profile includes MeerKAT, matching your search.",
              evidence: {
                biography: "Daniel studies radio signals.",
                methods: ["scintillation analysis"],
                instruments: ["MeerKAT"],
                software: ["PSRCHIVE"],
                keywords: ["scintillation"],
                publications: [],
              },
            },
          ],
        }),
      }),
    );

    render(<SearchExperience />);
    const input = screen.getByLabelText("Search for expertise");

    await user.type(input, "MeerKAT{enter}");

    expect(await screen.findByText("Daniel Brooks")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Daniel Brooks" })).toHaveAttribute(
      "href",
      "/people/daniel-brooks",
    );
    expect(screen.getByText("1 relevant person")).toBeInTheDocument();
    expect(
      screen.getByText("Why this person may be relevant"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Puter sign-in was cancelled/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry with AI" }),
    ).toBeInTheDocument();
  });

  it("renders a valid interpretation, topics, and grounded AI explanation", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        interpretedTopics: [],
        results: [
          {
            recommendationId: "10000000-0000-4000-8000-000000000106",
            id: "researcher_006",
            slug: "aisha-rahman",
            name: "Aisha Rahman",
            title: "Postdoctoral Researcher",
            role: "Fast Radio Burst Astronomer",
            researchAreas: ["fast radio bursts"],
            reason: "Deterministic reason.",
            evidence: {
              biography: "Aisha searches for fast radio bursts.",
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
            },
          },
          {
            recommendationId: "10000000-0000-4000-8000-000000000103",
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
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    puterAiMocks.interpretQuery.mockResolvedValue({
      kind: "ready",
      interpretation: "Finding specialists in brief radio signals.",
      interpretedTopics: ["Radio transients", "Signal detection"],
      searchTerms: ["fast radio bursts", "dedispersion"],
    });
    puterAiMocks.explainCandidates.mockImplementation(
      async (_query, candidates) => [
        {
          ...candidates[1],
          reason:
            "Priya's listed demo publication supports recent relevance to this question.",
          suggestedQuestion:
            "I am investigating brief radio signals. I noticed your work involves Bayesian inference - would you be able to point me towards the right approach?",
          isSuggestedContact: true,
        },
        {
          ...candidates[0],
          reason: "Aisha's stored profile covers burst searches.",
        },
      ],
    );

    render(
      <SearchExperience
        expertiseVocabulary={["fast radio bursts", "dedispersion"]}
      />,
    );
    await user.type(
      screen.getByLabelText("Search for expertise"),
      "a brief signal from far away{enter}",
    );

    expect(
      await screen.findByRole("heading", {
        name: "How your search was interpreted",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Finding specialists in brief radio signals."),
    ).toBeInTheDocument();
    expect(screen.getByText("Radio transients")).toBeInTheDocument();
    expect(screen.getByText("Signal detection")).toBeInTheDocument();
    const resultCards = screen.getAllByRole("article");
    expect(resultCards[0]).toHaveTextContent("Priya Nair");
    expect(resultCards[0]).toHaveTextContent("Suggested first contact");
    expect(resultCards[0]).toHaveTextContent(
      "Priya's listed demo publication supports recent relevance to this question.",
    );
    expect(resultCards[0]).toHaveTextContent("Suggested question to ask");
    expect(resultCards[0]).toHaveTextContent(
      "I am investigating brief radio signals.",
    );
    expect(resultCards[1]).toHaveTextContent("Aisha Rahman");
    expect(
      screen.getByText("Aisha's stored profile covers burst searches."),
    ).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      query: "a brief signal from far away",
      interpretedTerms: ["fast radio bursts", "dedispersion"],
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ feedback: "helpful" }),
    });
    await user.click(
      within(resultCards[0]).getByRole("button", { name: "Helpful" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({
      recommendationId: "10000000-0000-4000-8000-000000000103",
      feedback: "helpful",
      displayedPosition: 1,
      rankingMode: "ai",
    });
  });

  it("pauses an ambiguous search until a refinement is selected and submitted", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        interpretedTopics: [],
        results: [
          {
            recommendationId: "10000000-0000-4000-8000-000000000120",
            id: "researcher_020",
            slug: "jordan-lee",
            name: "Jordan Lee",
            title: "Instrument Scientist",
            role: "Radio Instrumentation Researcher",
            researchAreas: ["radio instrumentation"],
            reason: "Their stored profile includes instrument calibration.",
            evidence: {
              biography: "Jordan studies radio instrumentation.",
              methods: ["instrument calibration"],
              instruments: ["ASKAP"],
              software: [],
              keywords: ["calibration"],
              publications: [],
              matches: [],
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    puterAiMocks.interpretQuery.mockResolvedValue({
      kind: "refinement",
      question: "Are you mainly asking about the source or the instrument?",
      options: [
        {
          label: "Source astrophysics",
          refinedQuery: "What astrophysical process changed my pulsar brightness?",
          interpretation: "Finding expertise in astrophysical brightness changes.",
          interpretedTopics: ["Pulsar astrophysics"],
          searchTerms: ["pulsars"],
        },
        {
          label: "Instrument calibration",
          refinedQuery: "Could instrument calibration have changed my pulsar brightness?",
          interpretation: "Finding expertise in instrumental brightness changes.",
          interpretedTopics: ["Instrument calibration"],
          searchTerms: ["instrument calibration", "ASKAP"],
        },
      ],
    });

    render(
      <SearchExperience
        expertiseVocabulary={["pulsars", "instrument calibration", "ASKAP"]}
      />,
    );
    const input = screen.getByLabelText("Search for expertise");
    await user.type(input, "Why did my pulsar brightness change?{enter}");

    expect(
      await screen.findByRole("heading", {
        name: "Are you mainly asking about the source or the instrument?",
      }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Source astrophysics" }));
    expect(input).toHaveValue(
      "What astrophysical process changed my pulsar brightness?",
    );
    await user.click(
      screen.getByRole("button", { name: "Instrument calibration" }),
    );
    expect(input).toHaveValue(
      "Could instrument calibration have changed my pulsar brightness?",
    );
    expect(
      screen.getByRole("button", { name: "Instrument calibration" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Jordan Lee")).toBeInTheDocument();
    expect(puterAiMocks.interpretQuery).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      query: "Could instrument calibration have changed my pulsar brightness?",
      interpretedTerms: ["instrument calibration", "ASKAP"],
    });
    expect(puterAiMocks.explainCandidates).toHaveBeenCalledWith(
      "Could instrument calibration have changed my pulsar brightness?",
      expect.any(Array),
      expect.objectContaining({ chat: expect.any(Function) }),
    );
    expect(
      screen.getByText("Finding expertise in instrumental brightness changes."),
    ).toBeInTheDocument();
  });

  it("clears a pending refinement when the generated query is manually edited", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ interpretedTopics: [], results: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    puterAiMocks.interpretQuery
      .mockResolvedValueOnce({
        kind: "refinement",
        question: "Which part of the problem matters most?",
        options: [
          {
            label: "Astrophysics",
            refinedQuery: "Astrophysical pulsar brightness changes",
            interpretation: "Finding pulsar astrophysics expertise.",
            interpretedTopics: ["Pulsars"],
            searchTerms: ["pulsars"],
          },
          {
            label: "Calibration",
            refinedQuery: "Instrument calibration for pulsar observations",
            interpretation: "Finding calibration expertise.",
            interpretedTopics: ["Calibration"],
            searchTerms: ["instrument calibration"],
          },
        ],
      })
      .mockResolvedValueOnce({
        kind: "ready",
        interpretation: "Finding ASKAP expertise.",
        interpretedTopics: ["ASKAP"],
        searchTerms: ["ASKAP"],
      });

    render(
      <SearchExperience
        expertiseVocabulary={["pulsars", "instrument calibration", "ASKAP"]}
      />,
    );
    const input = screen.getByLabelText("Search for expertise");
    await user.type(input, "brightness changed{enter}");
    await screen.findByRole("heading", {
      name: "Which part of the problem matters most?",
    });
    await user.click(screen.getByRole("button", { name: "Calibration" }));

    await user.clear(input);
    await user.type(input, "ASKAP signal issue{enter}");

    expect(
      await screen.findByRole("heading", { name: "No strong matches found." }),
    ).toBeInTheDocument();
    expect(puterAiMocks.interpretQuery).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      query: "ASKAP signal issue",
      interpretedTerms: ["ASKAP"],
    });
  });

  it("keeps deterministic reasons when the explanation call fails", async () => {
    const user = userEvent.setup();
    puterAiMocks.interpretQuery.mockResolvedValue({
      kind: "ready",
      interpretation: "Finding pulsar specialists.",
      interpretedTopics: ["Pulsars"],
      searchTerms: ["pulsars"],
    });
    puterAiMocks.explainCandidates.mockRejectedValue(new Error("quota exhausted"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          interpretedTopics: [],
          results: [
            {
              recommendationId: "10000000-0000-4000-8000-000000000101",
              id: "researcher_001",
              slug: "maya-chen",
              name: "Maya Chen",
              title: "Senior Research Fellow",
              role: "Pulsar Astronomer",
              researchAreas: ["pulsars"],
              reason: "Their stored profile includes pulsars.",
              evidence: {
                biography: "Maya studies pulsars.",
                methods: ["pulsar timing"],
                instruments: ["MeerKAT"],
                software: ["TEMPO2"],
                keywords: ["timing noise"],
                publications: [],
              },
            },
            {
              recommendationId: "10000000-0000-4000-8000-000000000202",
              id: "researcher_002",
              slug: "daniel-brooks",
              name: "Daniel Brooks",
              title: "Research Fellow",
              role: "Radio Astronomer",
              researchAreas: ["radio astronomy"],
              reason: "Their stored profile includes scintillation analysis.",
              evidence: {
                biography: "Daniel studies radio propagation.",
                methods: ["scintillation analysis"],
                instruments: ["MeerKAT"],
                software: ["PSRCHIVE"],
                keywords: ["scintillation"],
                publications: [],
              },
            },
          ],
        }),
      }),
    );

    render(<SearchExperience expertiseVocabulary={["pulsars"]} />);
    await user.type(
      screen.getByLabelText("Search for expertise"),
      "pulsar work{enter}",
    );

    expect(
      await screen.findByText("Their stored profile includes pulsars."),
    ).toBeInTheDocument();
    const resultCards = screen.getAllByRole("article");
    expect(resultCards[0]).toHaveTextContent("Maya Chen");
    expect(resultCards[0]).toHaveTextContent(
      "Their stored profile includes pulsars.",
    );
    expect(resultCards[1]).toHaveTextContent("Daniel Brooks");
    expect(resultCards[1]).toHaveTextContent(
      "Their stored profile includes scintillation analysis.",
    );
    expect(
      screen.getByText(/Puter AI allowance is unavailable/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Suggested first contact")).not.toBeInTheDocument();
    expect(screen.queryByText("Suggested question to ask")).not.toBeInTheDocument();
  });

  it("renders the documented empty-results guidance", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ interpretedTopics: [], results: [] }),
      }),
    );

    render(<SearchExperience />);
    await user.type(
      screen.getByLabelText("Search for expertise"),
      "nanofabrication{enter}",
    );

    expect(
      await screen.findByRole("heading", { name: "No strong matches found." }),
    ).toBeInTheDocument();
  });

  it("announces a controlled API error", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: {
            code: "SEARCH_UNAVAILABLE",
            message: "Search is temporarily unavailable. Please try again.",
          },
        }),
      }),
    );

    render(<SearchExperience />);
    await user.type(
      screen.getByLabelText("Search for expertise"),
      "pulsars{enter}",
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Search is temporarily unavailable. Please try again.",
    );
  });
});
