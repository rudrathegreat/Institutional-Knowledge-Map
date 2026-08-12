import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PeopleDirectory } from "@/components/PeopleDirectory";
import { EMPTY_PEOPLE_FILTERS } from "@/lib/people-filters";

const people = [
  {
    id: "maya",
    slug: "maya-chen",
    name: "Maya Chen",
    title: "Senior Research Fellow",
    role: "Pulsar Astronomer",
    researchAreas: ["pulsars", "radio astronomy"],
    researchGroups: [
      { id: "radio", name: "Radio Astronomy", isPrimary: true },
      { id: "methods", name: "Research Methods", isPrimary: false },
    ],
  },
  {
    id: "zoe",
    slug: "zoe-marin",
    name: "Zoe Marin",
    title: "Research Software Engineer",
    role: "Scientific Workflow Specialist",
    researchAreas: ["research software"],
    researchGroups: [
      { id: "methods", name: "Research Methods", isPrimary: true },
    ],
  },
];

describe("PeopleDirectory", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/people?view=compact");
  });

  it("filters immediately, preserves unrelated URL state, and clears filters", async () => {
    const user = userEvent.setup();
    const replaceState = vi.spyOn(window.history, "replaceState");
    render(
      <PeopleDirectory initialFilters={EMPTY_PEOPLE_FILTERS} people={people} />,
    );

    await user.click(screen.getByRole("button", { name: "Research groups" }));
    await user.click(screen.getByRole("checkbox", { name: "Research Methods" }));
    expect(screen.getByText("2 of 2 people")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Research groups, 1 selected" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Appointment titles" }));
    await user.click(
      screen.getByRole("checkbox", { name: "Research Software Engineer" }),
    );
    expect(screen.getByText("1 of 2 people")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Zoe Marin/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Maya Chen/ })).not.toBeInTheDocument();
    expect(window.location.search).toContain("view=compact");
    expect(window.location.search).toContain("group=methods");
    expect(replaceState).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByText("2 people")).toBeInTheDocument();
    expect(window.location.search).toBe("?view=compact");
  });

  it("searches research-area options without changing results", async () => {
    const user = userEvent.setup();
    render(
      <PeopleDirectory initialFilters={EMPTY_PEOPLE_FILTERS} people={people} />,
    );

    await user.click(screen.getByRole("button", { name: "Research areas" }));
    await user.type(
      screen.getByRole("searchbox", { name: "Search research areas" }),
      "puls",
    );
    const areas = screen.getByRole("group", { name: "Research areas" });
    expect(within(areas).getByRole("checkbox", { name: "pulsars" })).toBeInTheDocument();
    expect(within(areas).queryByRole("checkbox", { name: "research software" })).not.toBeInTheDocument();
    expect(screen.getByText("2 people")).toBeInTheDocument();
  });

  it("shows a resettable no-results state", async () => {
    const user = userEvent.setup();
    render(
      <PeopleDirectory initialFilters={EMPTY_PEOPLE_FILTERS} people={people} />,
    );

    await user.click(screen.getByRole("button", { name: "Appointment titles" }));
    await user.click(screen.getByRole("checkbox", { name: "Senior Research Fellow" }));
    await user.click(screen.getByRole("button", { name: "Research areas" }));
    await user.click(
      screen.getByRole("checkbox", { name: "research software" }),
    );

    expect(
      screen.getByRole("heading", { name: "No people match these filters" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("opens one dropdown at a time and closes it with Escape", async () => {
    const user = userEvent.setup();
    render(
      <PeopleDirectory initialFilters={EMPTY_PEOPLE_FILTERS} people={people} />,
    );

    const groupTrigger = screen.getByRole("button", {
      name: "Research groups",
    });
    await user.click(groupTrigger);
    expect(groupTrigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("group", { name: "Research groups" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Appointment titles" }));
    expect(groupTrigger).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("group", { name: "Research groups" }),
    ).not.toBeInTheDocument();

    const titleTrigger = screen.getByRole("button", {
      name: "Appointment titles",
    });
    await user.keyboard("{Escape}");
    expect(titleTrigger).toHaveAttribute("aria-expanded", "false");
    expect(titleTrigger).toHaveFocus();
  });
});
