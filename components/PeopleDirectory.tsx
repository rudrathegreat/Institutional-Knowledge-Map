"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PeopleFilters } from "@/components/PeopleFilters";
import type { ResearchGroupSummary } from "@/lib/api-types";
import {
  derivePeopleFilterOptions,
  hasActivePeopleFilters,
  matchesPeopleFilters,
  type PeopleFilterState,
  updatePeopleFilterSearchParams,
} from "@/lib/people-filters";

export interface PeopleDirectoryPerson {
  id: string;
  slug: string;
  name: string;
  title: string;
  role: string;
  researchAreas: string[];
  researchGroups: ResearchGroupSummary[];
}

interface PeopleDirectoryProps {
  initialFilters: PeopleFilterState;
  people: PeopleDirectoryPerson[];
}

function replaceFilterUrl(filters: PeopleFilterState) {
  const searchParams = updatePeopleFilterSearchParams(
    new URLSearchParams(window.location.search),
    filters,
  );
  const query = searchParams.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", nextUrl);
}

export function PeopleDirectory({
  initialFilters,
  people,
}: PeopleDirectoryProps) {
  const [filters, setFilters] = useState(initialFilters);
  const options = useMemo(() => derivePeopleFilterOptions(people), [people]);
  const visiblePeople = useMemo(
    () => people.filter((person) => matchesPeopleFilters(person, filters)),
    [filters, people],
  );
  const isFiltered = hasActivePeopleFilters(filters);

  function updateFilters(nextFilters: PeopleFilterState) {
    setFilters(nextFilters);
    replaceFilterUrl(nextFilters);
  }

  return (
    <>
      <PeopleFilters
        filters={filters}
        options={options}
        onChange={updateFilters}
      />

      <p className="directoryCount" aria-live="polite">
        {isFiltered
          ? `${visiblePeople.length} of ${people.length} people`
          : `${people.length} ${people.length === 1 ? "person" : "people"}`}
      </p>

      {visiblePeople.length > 0 ? (
        <div className="directoryList">
          {visiblePeople.map((person) => (
            <article className="directoryPerson" key={person.id}>
              <Link
                className="directoryPersonLink"
                href={`/people/${person.slug}`}
              >
                <span className="directoryPersonIdentity">
                  <span className="directoryPersonName">{person.name}</span>
                  <span className="directoryPersonRole">
                    {person.title}
                    <span aria-hidden="true"> · </span>
                    {person.role}
                  </span>
                </span>
                <span
                  className="directoryPersonExpertise"
                  aria-label="Research areas"
                >
                  {person.researchAreas.join(" · ")}
                </span>
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="directoryNoResults">
          <h2>No people match these filters</h2>
          <p>Try removing one or more filters to broaden the directory.</p>
          <button type="button" onClick={() => updateFilters({
            groupIds: [],
            titles: [],
            researchAreas: [],
          })}>
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
