import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SearchExperience } from "@/components/SearchExperience";

const puterAiMocks = vi.hoisted(() => ({
  interpretQuery: vi.fn(),
  explainCandidates: vi.fn(),
}));

vi.mock("@/lib/puter-ai", () => puterAiMocks);

beforeEach(() => {
  puterAiMocks.interpretQuery.mockRejectedValue(new Error("sign-in cancelled"));
  puterAiMocks.explainCandidates.mockImplementation(
    async (_query, candidates) => candidates,
  );
});

afterEach(() => {
  vi.clearAllMocks();
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
    expect(
      screen.getByText(/AI interpretation was unavailable/),
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
    expect(resultCards[1]).toHaveTextContent("Aisha Rahman");
    expect(
      screen.getByText("Aisha's stored profile covers burst searches."),
    ).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      query: "a brief signal from far away",
      interpretedTerms: ["fast radio bursts", "dedispersion"],
    });
  });

  it("keeps deterministic reasons when the explanation call fails", async () => {
    const user = userEvent.setup();
    puterAiMocks.interpretQuery.mockResolvedValue({
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
    expect(screen.getByText(/AI explanations were unavailable/)).toBeInTheDocument();
    expect(screen.queryByText("Suggested first contact")).not.toBeInTheDocument();
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
