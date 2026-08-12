"use client";

import {
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  countActivePeopleFilters,
  EMPTY_PEOPLE_FILTERS,
  type PeopleFilterOptions,
  type PeopleFilterState,
} from "@/lib/people-filters";

interface PeopleFiltersProps {
  filters: PeopleFilterState;
  options: PeopleFilterOptions;
  onChange: (filters: PeopleFilterState) => void;
}

type FilterFacet = "groups" | "titles" | "areas";

interface FilterDropdownProps {
  children: ReactNode;
  count: number;
  id: string;
  isOpen: boolean;
  label: string;
  onToggle: () => void;
}

function FilterDropdown({
  children,
  count,
  id,
  isOpen,
  label,
  onToggle,
}: FilterDropdownProps) {
  return (
    <div className={`peopleFilterDropdown${isOpen ? " is-open" : ""}`}>
      <button
        className="peopleFilterTrigger"
        type="button"
        aria-controls={id}
        aria-expanded={isOpen}
        aria-label={count > 0 ? `${label}, ${count} selected` : label}
        onClick={onToggle}
      >
        <span>{label}</span>
        {count > 0 ? (
          <span className="peopleFilterTriggerCount" aria-hidden="true">
            {count}
          </span>
        ) : null}
        <span className="peopleFilterChevron" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="peopleFilterMenu" id={id}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value].sort((left, right) => left.localeCompare(right, "en"));
}

export function PeopleFilters({
  filters,
  options,
  onChange,
}: PeopleFiltersProps) {
  const filterHeadingId = useId();
  const menuIdPrefix = useId();
  const areaSearchId = useId();
  const containerRef = useRef<HTMLElement>(null);
  const [openFacet, setOpenFacet] = useState<FilterFacet>();
  const [areaSearch, setAreaSearch] = useState("");
  const activeCount = countActivePeopleFilters(filters);
  const visibleResearchAreas = useMemo(() => {
    const query = areaSearch.trim().toLocaleLowerCase("en");
    return query
      ? options.researchAreas.filter((area) =>
          area.toLocaleLowerCase("en").includes(query),
        )
      : options.researchAreas;
  }, [areaSearch, options.researchAreas]);

  useEffect(() => {
    if (!openFacet) {
      return;
    }

    function closeOnOutsideClick(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpenFacet(undefined);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [openFacet]);

  function toggleFacet(facet: FilterFacet) {
    setOpenFacet((current) => (current === facet ? undefined : facet));
  }

  return (
    <section
      className="peopleFilters"
      aria-labelledby={filterHeadingId}
      ref={containerRef}
      onKeyDown={(event) => {
        if (event.key === "Escape" && openFacet) {
          event.preventDefault();
          const trigger = containerRef.current?.querySelector<HTMLButtonElement>(
            '.peopleFilterTrigger[aria-expanded="true"]',
          );
          setOpenFacet(undefined);
          trigger?.focus();
        }
      }}
    >
      <h2 className="srOnly" id={filterHeadingId}>
        Filter people
      </h2>

      <div className="peopleFilterControls">
        <span className="peopleFilterLabel">Filter by</span>

        <FilterDropdown
          count={filters.groupIds.length}
          id={`${menuIdPrefix}-groups`}
          isOpen={openFacet === "groups"}
          label="Research groups"
          onToggle={() => toggleFacet("groups")}
        >
          <fieldset>
            <legend>Research groups</legend>
            <div className="peopleFilterOptions">
              {options.groups.map(({ value, label }) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={filters.groupIds.includes(value)}
                    onChange={() =>
                      onChange({
                        ...filters,
                        groupIds: toggleValue(filters.groupIds, value),
                      })
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </FilterDropdown>

        <FilterDropdown
          count={filters.titles.length}
          id={`${menuIdPrefix}-titles`}
          isOpen={openFacet === "titles"}
          label="Appointment titles"
          onToggle={() => toggleFacet("titles")}
        >
          <fieldset>
            <legend>Appointment titles</legend>
            <div className="peopleFilterOptions">
              {options.titles.map((title) => (
                <label key={title}>
                  <input
                    type="checkbox"
                    checked={filters.titles.includes(title)}
                    onChange={() =>
                      onChange({
                        ...filters,
                        titles: toggleValue(filters.titles, title),
                      })
                    }
                  />
                  <span>{title}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </FilterDropdown>

        <FilterDropdown
          count={filters.researchAreas.length}
          id={`${menuIdPrefix}-areas`}
          isOpen={openFacet === "areas"}
          label="Research areas"
          onToggle={() => toggleFacet("areas")}
        >
          <fieldset>
            <legend>Research areas</legend>
            <label className="peopleFilterAreaSearch" htmlFor={areaSearchId}>
              <span className="srOnly">Search research areas</span>
              <input
                id={areaSearchId}
                type="search"
                value={areaSearch}
                placeholder="Search research areas"
                onChange={(event) => setAreaSearch(event.target.value)}
              />
            </label>
            <div className="peopleFilterOptions peopleFilterAreaOptions">
              {visibleResearchAreas.length > 0 ? (
                visibleResearchAreas.map((area) => (
                  <label key={area}>
                    <input
                      type="checkbox"
                      checked={filters.researchAreas.includes(area)}
                      onChange={() =>
                        onChange({
                          ...filters,
                          researchAreas: toggleValue(
                            filters.researchAreas,
                            area,
                          ),
                        })
                      }
                    />
                    <span>{area}</span>
                  </label>
                ))
              ) : (
                <p>No research areas match “{areaSearch.trim()}”.</p>
              )}
            </div>
          </fieldset>
        </FilterDropdown>
      </div>

      <div className="peopleFilterStatus">
        <span aria-live="polite">
          {activeCount} active {activeCount === 1 ? "filter" : "filters"}
        </span>
        <button
          type="button"
          disabled={activeCount === 0}
          onClick={() => {
            setAreaSearch("");
            setOpenFacet(undefined);
            onChange(EMPTY_PEOPLE_FILTERS);
          }}
        >
          Clear all
        </button>
      </div>
    </section>
  );
}
