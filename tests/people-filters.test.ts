import { describe, expect, it } from "vitest";

import {
  derivePeopleFilterOptions,
  matchesPeopleFilters,
  parsePeopleFilters,
  updatePeopleFilterSearchParams,
} from "@/lib/people-filters";

const people = [
  {
    title: "Research Fellow",
    researchAreas: ["pulsars", "radio astronomy"],
    researchGroups: [
      { id: "radio", name: "Radio Astronomy" },
      { id: "methods", name: "Research Methods" },
    ],
  },
  {
    title: "Lecturer",
    researchAreas: ["galaxy evolution", "radio astronomy"],
    researchGroups: [{ id: "galaxies", name: "Galaxies" }],
  },
];

describe("people filters", () => {
  it("derives unique alphabetised options", () => {
    expect(derivePeopleFilterOptions(people)).toEqual({
      groups: [
        { value: "galaxies", label: "Galaxies" },
        { value: "radio", label: "Radio Astronomy" },
        { value: "methods", label: "Research Methods" },
      ],
      titles: ["Lecturer", "Research Fellow"],
      researchAreas: ["galaxy evolution", "pulsars", "radio astronomy"],
    });
  });

  it("parses valid repeated values and ignores unknown values", () => {
    const options = derivePeopleFilterOptions(people);
    const query = new URLSearchParams(
      "group=methods&group=unknown&title=Lecturer&area=radio+astronomy",
    );

    expect(parsePeopleFilters(query, options)).toEqual({
      groupIds: ["methods"],
      titles: ["Lecturer"],
      researchAreas: ["radio astronomy"],
    });
  });

  it("uses OR within facets and AND across facets, including secondary groups", () => {
    expect(
      matchesPeopleFilters(people[0], {
        groupIds: ["methods"],
        titles: ["Lecturer", "Research Fellow"],
        researchAreas: ["pulsars", "galaxy evolution"],
      }),
    ).toBe(true);
    expect(
      matchesPeopleFilters(people[1], {
        groupIds: ["methods"],
        titles: ["Lecturer", "Research Fellow"],
        researchAreas: ["pulsars", "galaxy evolution"],
      }),
    ).toBe(false);
  });

  it("serializes canonical filter values and preserves unrelated parameters", () => {
    const updated = updatePeopleFilterSearchParams(
      new URLSearchParams("view=compact&group=old"),
      {
        groupIds: ["radio", "methods"],
        titles: ["Research Fellow"],
        researchAreas: ["pulsars"],
      },
    );

    expect(updated.get("view")).toBe("compact");
    expect(updated.getAll("group")).toEqual(["methods", "radio"]);
    expect(updated.getAll("title")).toEqual(["Research Fellow"]);
    expect(updated.getAll("area")).toEqual(["pulsars"]);
  });
});
