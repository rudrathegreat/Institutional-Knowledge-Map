import { render, screen, within } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import PersonNotFound from "@/app/people/[slug]/not-found";
import PersonPage, {
  generateMetadata,
} from "@/app/people/[slug]/page";
import PeoplePage from "@/app/people/page";
import { closeDatabase } from "@/lib/db";
import { getPersonBySlug, listPeople } from "@/lib/people";
import { seedDatabase } from "@/lib/seed";

const TEST_DATABASE_PATH = path.resolve(
  process.cwd(),
  "data",
  "people-test.sqlite",
);

function removeTestDatabase() {
  for (const suffix of ["", "-shm", "-wal"]) {
    fs.rmSync(`${TEST_DATABASE_PATH}${suffix}`, { force: true });
  }
}

describe("people directory and profiles", () => {
  beforeAll(() => {
    process.env.DATABASE_PATH = TEST_DATABASE_PATH;
    seedDatabase(TEST_DATABASE_PATH);
  });

  afterAll(() => {
    closeDatabase();
    delete process.env.DATABASE_PATH;
    removeTestDatabase();
  });

  it("lists every person alphabetically with stable profile links", () => {
    const people = listPeople();
    const names = people.map((person) => person.name);

    expect(people).toHaveLength(30);
    expect(names).toEqual([...names].sort());
    expect(getPersonBySlug("maya-chen")?.id).toBe("researcher_001");
    expect(getPersonBySlug("maya-chen")?.researchGroups).toEqual([
      {
        id: "group_radio_pulsars",
        name: "Radio Astronomy & Pulsars",
        isPrimary: true,
      },
    ]);

    render(<PeoplePage />);

    expect(screen.getByText("30 people")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(30);
    expect(screen.getByRole("link", { name: /Maya Chen/ })).toHaveAttribute(
      "href",
      "/people/maya-chen",
    );
  });

  it("renders all stored fields on a profile with person-specific metadata", async () => {
    const page = await PersonPage({
      params: Promise.resolve({ slug: "maya-chen" }),
    });
    render(page);

    expect(screen.getByRole("heading", { name: "Maya Chen" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument();
    expect(screen.getByText(/long-baseline pulsar timing/)).toBeInTheDocument();
    expect(screen.getByText("neutron stars")).toBeInTheDocument();
    expect(screen.getByText("time-series analysis")).toBeInTheDocument();
    expect(screen.getByText("Murriyang")).toBeInTheDocument();
    expect(screen.getByText("TEMPO2")).toBeInTheDocument();
    expect(screen.getByText("compact objects")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Research groups" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Radio Astronomy & Pulsars")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Mock ORCID iD")).toBeInTheDocument();
    expect(screen.getByText("0000-0000-DEMO-0001").closest("a")).toBeNull();
    expect(
      screen.getByText(
        "The ORCID iD and publications are fictional prototype data.",
      ),
    ).toBeInTheDocument();

    const publicationSection = screen
      .getByRole("heading", { name: "Recent publications" })
      .closest("section");
    expect(publicationSection).not.toBeNull();

    const publicationItems = within(publicationSection!).getAllByRole("listitem");
    expect(publicationItems).toHaveLength(3);
    expect(publicationItems[0]).toHaveTextContent(
      "Long-baseline pulsar timing constraints on rotational noise with MeerKAT",
    );
    expect(publicationItems[1]).toHaveTextContent(
      "Ephemeris modelling for subtle neutron-star timing residuals",
    );
    expect(publicationItems[2]).toHaveTextContent(
      "Combining Murriyang and MeerKAT pulse arrival times with TEMPO2",
    );
    expect(within(publicationSection!).queryAllByRole("link")).toHaveLength(0);

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: "maya-chen" }),
      }),
    ).resolves.toMatchObject({
      title: "Maya Chen",
      description: expect.stringContaining("neutron stars"),
    });
  });

  it("uses the not-found boundary for unknown profile slugs", async () => {
    await expect(
      PersonPage({
        params: Promise.resolve({ slug: "unknown-person" }),
      }),
    ).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");

    render(<PersonNotFound />);
    expect(
      screen.getByRole("heading", { name: "Person not found" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse all people" })).toHaveAttribute(
      "href",
      "/people",
    );
  });
});
