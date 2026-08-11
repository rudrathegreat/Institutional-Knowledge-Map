import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchResult } from "@/components/SearchResult";
import type { SearchResultPayload } from "@/lib/api-types";

const result: SearchResultPayload = {
  recommendationId: "10000000-0000-4000-8000-000000000002",
  id: "researcher_002",
  slug: "daniel-brooks",
  name: "Daniel Brooks",
  title: "Research Fellow",
  role: "Radio Astronomer",
  researchAreas: ["pulsars", "radio astronomy"],
  reason: "Their stored profile includes MeerKAT, matching your search.",
  suggestedQuestion:
    "I am investigating signal propagation with MeerKAT. I noticed your work involves scintillation analysis - would you be able to point me towards the right approach?",
  evidence: {
    biography: "Daniel studies radio signals and propagation.",
    methods: ["scintillation analysis"],
    instruments: ["MeerKAT"],
    software: ["PSRCHIVE"],
    keywords: ["scintillation"],
    publications: [],
    matches: [
      {
        category: "instrument",
        value: "MeerKAT",
        origins: ["query"],
        matchedTerms: ["MeerKAT"],
      },
      {
        category: "method",
        value: "scintillation analysis",
        origins: ["query", "interpreted"],
        matchedTerms: ["scintillation", "scintillation analysis"],
      },
      {
        category: "biography",
        value: "Daniel studies radio signals and propagation.",
        origins: ["interpreted"],
        matchedTerms: ["radio propagation"],
      },
    ],
  },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SearchResult evidence disclosure", () => {
  it("keeps the reason visible and expands traced evidence accessibly", async () => {
    const user = userEvent.setup();
    render(
      <SearchResult
        result={result}
        displayedPosition={1}
        rankingMode="deterministic"
      />,
    );

    expect(screen.getByText(result.reason)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Suggested question to ask" }),
    ).toBeVisible();
    const summary = screen.getByText("View matching evidence");
    const disclosure = summary.closest("details");

    expect(disclosure).not.toHaveAttribute("open");
    summary.focus();
    expect(summary).toHaveFocus();
    expect(summary.tagName).toBe("SUMMARY");
    await user.click(summary);

    expect(disclosure).toHaveAttribute("open");
    expect(
      screen.getByRole("heading", { name: "Matched your search" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Matched interpreted terms" }),
    ).toBeVisible();
    expect(screen.getByText("Interpreted as: radio propagation")).toBeVisible();
    expect(screen.getByText("MeerKAT")).toBeVisible();
    expect(screen.getAllByText("scintillation analysis")).toHaveLength(1);
  });

  it("copies the suggested question and announces success", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(
      <SearchResult result={result} displayedPosition={1} rankingMode="ai" />,
    );

    await user.click(
      screen.getByRole("button", { name: "Copy suggested question" }),
    );

    expect(writeText).toHaveBeenCalledWith(result.suggestedQuestion);
    expect(screen.getByText("Suggested question copied.")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Suggested question copied" }),
    ).toHaveTextContent("Copied");
  });

  it("keeps the text available when clipboard writing fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(
      new Error("clipboard blocked"),
    );
    render(
      <SearchResult result={result} displayedPosition={1} rankingMode="ai" />,
    );

    await user.click(
      screen.getByRole("button", { name: "Copy suggested question" }),
    );

    expect(
      screen.getByText(/Select the text to copy it manually\./),
    ).toBeVisible();
    expect(screen.getByText(result.suggestedQuestion ?? "")).toBeVisible();
  });

  it("keeps disclosures independent across result cards", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SearchResult
          result={result}
          displayedPosition={1}
          rankingMode="deterministic"
        />
        <SearchResult
          result={{
            ...result,
            recommendationId: "10000000-0000-4000-8000-000000000003",
            id: "researcher_003",
            name: "Priya Nair",
          }}
          displayedPosition={2}
          rankingMode="deterministic"
        />
      </>,
    );

    const articles = screen.getAllByRole("article");
    await user.click(
      within(articles[0]).getByText("View matching evidence"),
    );

    expect(articles[0].querySelector("details")).toHaveAttribute("open");
    expect(articles[1].querySelector("details")).not.toHaveAttribute("open");
  });

  it("saves query-specific feedback and allows the answer to change", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ feedback: "helpful" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SearchResult result={result} displayedPosition={2} rankingMode="ai" />,
    );

    const helpfulButton = screen.getByRole("button", { name: "Helpful" });
    const notRelevantButton = screen.getByRole("button", {
      name: "Not relevant",
    });

    expect(helpfulButton).toHaveAttribute("aria-pressed", "false");
    await user.click(helpfulButton);

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/recommendation-feedback",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          recommendationId: result.recommendationId,
          feedback: "helpful",
          displayedPosition: 2,
          rankingMode: "ai",
        }),
      }),
    );
    expect(helpfulButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Thanks — feedback saved.")).toBeVisible();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ feedback: "not_relevant" }),
    });
    await user.click(notRelevantButton);

    expect(helpfulButton).toHaveAttribute("aria-pressed", "false");
    expect(notRelevantButton).toHaveAttribute("aria-pressed", "true");
  });

  it("preserves the saved answer when an update fails", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ feedback: "helpful" }),
      })
      .mockRejectedValueOnce(new Error("network unavailable"));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SearchResult
        result={result}
        displayedPosition={1}
        rankingMode="deterministic"
      />,
    );

    const helpfulButton = screen.getByRole("button", { name: "Helpful" });
    await user.click(helpfulButton);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      recommendationId: result.recommendationId,
      feedback: "helpful",
      displayedPosition: 1,
      rankingMode: "deterministic",
    });
    await user.click(screen.getByRole("button", { name: "Not relevant" }));

    expect(helpfulButton).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText("Could not save feedback. Please try again."),
    ).toBeVisible();
  });

  it("keeps feedback selections independent across result cards", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const request = JSON.parse(String(init?.body)) as {
          feedback: "helpful" | "not_relevant";
        };

        return {
          ok: true,
          json: async () => ({ feedback: request.feedback }),
        };
      }),
    );

    render(
      <>
        <SearchResult
          result={result}
          displayedPosition={1}
          rankingMode="deterministic"
        />
        <SearchResult
          result={{
            ...result,
            recommendationId: "10000000-0000-4000-8000-000000000003",
            id: "researcher_003",
            name: "Priya Nair",
          }}
          displayedPosition={2}
          rankingMode="deterministic"
        />
      </>,
    );

    const articles = screen.getAllByRole("article");
    await user.click(
      within(articles[0]).getByRole("button", { name: "Helpful" }),
    );

    expect(
      within(articles[0]).getByRole("button", { name: "Helpful" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(articles[1]).getByRole("button", { name: "Helpful" }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
