import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchExperience } from "@/components/SearchExperience";

afterEach(() => {
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
              name: "Daniel Brooks",
              title: "Research Fellow",
              role: "Radio Astronomer",
              researchAreas: ["pulsars", "radio astronomy"],
              reason:
                "Their stored profile includes MeerKAT, matching your search.",
            },
          ],
        }),
      }),
    );

    render(<SearchExperience />);
    const input = screen.getByLabelText("Search for expertise");

    await user.type(input, "MeerKAT{enter}");

    expect(await screen.findByText("Daniel Brooks")).toBeInTheDocument();
    expect(screen.getByText("1 relevant person")).toBeInTheDocument();
    expect(
      screen.getByText("Why this person may be relevant"),
    ).toBeInTheDocument();
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
