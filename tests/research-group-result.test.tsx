import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ResearchGroupSearchResult } from "@/components/ResearchGroupSearchResult";
import type { ResearchGroupSearchResultPayload } from "@/lib/api-types";

const result: ResearchGroupSearchResultPayload = {
  id: "group_transients",
  slug: "transients-multi-messenger-astronomy",
  name: "Transients & Multi-Messenger Astronomy",
  summary: "The group investigates short-lived and variable events.",
  researchAreas: ["fast radio bursts", "multi-messenger astronomy"],
  memberCount: 7,
  reason: "The group's curated focus areas include fast radio bursts.",
  evidence: {
    matches: [
      {
        category: "researchArea",
        value: "fast radio bursts",
        origins: ["interpreted"],
        matchedTerms: ["fast radio bursts"],
      },
    ],
  },
};

describe("ResearchGroupSearchResult", () => {
  it("renders a compact linked group result with accessible evidence", async () => {
    const user = userEvent.setup();
    render(<ResearchGroupSearchResult result={result} />);

    expect(screen.getByText("Research group")).toBeVisible();
    expect(screen.getByRole("link", { name: result.name })).toHaveAttribute(
      "href",
      "/groups/transients-multi-messenger-astronomy",
    );
    expect(screen.getByText("7 members")).toBeVisible();
    expect(screen.getByText(result.reason)).toBeVisible();
    expect(screen.queryByText("Suggested first contact")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Helpful" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByText("View matching evidence"));
    const article = screen.getByRole("article");
    expect(within(article).getByText("Interpreted as: fast radio bursts")).toBeVisible();
  });
});
