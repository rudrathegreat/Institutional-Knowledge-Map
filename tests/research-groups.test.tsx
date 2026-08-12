import { render, screen, within } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import ResearchGroupNotFound from "@/app/groups/[slug]/not-found";
import ResearchGroupPage, {
  generateMetadata,
} from "@/app/groups/[slug]/page";
import { closeDatabase } from "@/lib/db";
import { getResearchGroupBySlug } from "@/lib/research-groups";
import { seedDatabase } from "@/lib/seed";

const TEST_DATABASE_PATH = path.resolve(
  process.cwd(),
  "data",
  "research-groups-test.sqlite",
);

function removeTestDatabase() {
  for (const suffix of ["", "-shm", "-wal"]) {
    fs.rmSync(`${TEST_DATABASE_PATH}${suffix}`, { force: true });
  }
}

describe("research-group profiles", () => {
  beforeAll(() => {
    process.env.DATABASE_PATH = TEST_DATABASE_PATH;
    seedDatabase(TEST_DATABASE_PATH);
  });

  afterAll(() => {
    closeDatabase();
    delete process.env.DATABASE_PATH;
    removeTestDatabase();
  });

  it("loads a group with every member alphabetically", async () => {
    const group = getResearchGroupBySlug("radio-astronomy-pulsars");
    expect(group?.members).toHaveLength(7);
    expect(group?.members.map(({ name }) => name)).toEqual(
      [...(group?.members ?? [])].map(({ name }) => name).sort(),
    );

    render(
      await ResearchGroupPage({
        params: Promise.resolve({ slug: "radio-astronomy-pulsars" }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Radio Astronomy & Pulsars" }),
    ).toBeInTheDocument();
    expect(screen.getByText("7 members")).toBeInTheDocument();
    expect(screen.getByText("pulsars")).toBeInTheDocument();
    const memberSection = screen
      .getByRole("heading", { name: "People in this group" })
      .closest("section");
    expect(within(memberSection!).getAllByRole("listitem")).toHaveLength(7);
    expect(within(memberSection!).getByRole("link", { name: /Maya Chen/ })).toHaveAttribute(
      "href",
      "/people/maya-chen",
    );
    expect(
      within(memberSection!).getAllByText("Primary group").length,
    ).toBeGreaterThan(0);
    expect(
      within(memberSection!).getAllByText("Secondary group").length,
    ).toBeGreaterThan(0);

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: "radio-astronomy-pulsars" }),
      }),
    ).resolves.toMatchObject({
      title: "Radio Astronomy & Pulsars",
      description: expect.stringContaining("precision timing"),
    });
  });

  it("uses the not-found boundary for an unknown group", async () => {
    await expect(
      ResearchGroupPage({ params: Promise.resolve({ slug: "unknown-group" }) }),
    ).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");

    render(<ResearchGroupNotFound />);
    expect(
      screen.getByRole("heading", { name: "Research group not found" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to search" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
