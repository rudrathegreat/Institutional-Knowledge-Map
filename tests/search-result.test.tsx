import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchResult } from "@/components/SearchResult";
import type { SearchResultPayload } from "@/lib/api-types";

const result: SearchResultPayload = {
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

describe("SearchResult evidence disclosure", () => {
  it("keeps the reason visible and expands traced evidence accessibly", async () => {
    const user = userEvent.setup();
    render(<SearchResult result={result} />);

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
    render(<SearchResult result={result} />);

    await user.click(
      screen.getByRole("button", { name: "Copy suggested question" }),
    );

    expect(writeText).toHaveBeenCalledWith(result.suggestedQuestion);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Suggested question copied.",
    );
    expect(
      screen.getByRole("button", { name: "Suggested question copied" }),
    ).toHaveTextContent("Copied");
  });

  it("keeps the text available when clipboard writing fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(
      new Error("clipboard blocked"),
    );
    render(<SearchResult result={result} />);

    await user.click(
      screen.getByRole("button", { name: "Copy suggested question" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Select the text to copy it manually.",
    );
    expect(screen.getByText(result.suggestedQuestion ?? "")).toBeVisible();
  });

  it("keeps disclosures independent across result cards", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SearchResult result={result} />
        <SearchResult
          result={{ ...result, id: "researcher_003", name: "Priya Nair" }}
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
});
